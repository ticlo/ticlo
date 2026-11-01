import {Block, type BlockProperty} from '@ticlo/core';
import type {ElementMap} from '@ticlo/react';
import {getPlaneInverse, getStageElementGeometry, projectPoint} from './StageGeometry.ts';

interface MoveTarget {
  block: Block;
  helper: Block | null;
  createHelper: boolean;
  style: Record<string, unknown>;
  x: 'left' | 'right';
  y: 'top' | 'bottom';
  left: number;
  top: number;
  optional: string[];
  addOptional: boolean;
}

interface SvgMoveTarget {
  block: Block;
  inverse: DOMMatrix;
  start: {x: number; y: number};
  values: {name: string; axis: 'x' | 'y'; value: number; suffix: string; string: boolean}[];
  points?: {x: number; y: number}[];
  transform?: DOMMatrix;
  optional: string[];
  additions: string[];
}

const svgPositionAttributes: Record<string, [string, string][]> = {
  svg: [['x', 'y']],
  rect: [['x', 'y']],
  circle: [['cx', 'cy']],
  ellipse: [['cx', 'cy']],
  line: [
    ['x1', 'y1'],
    ['x2', 'y2'],
  ],
  text: [['x', 'y']],
  foreignObject: [['x', 'y']],
};

function svgNumber(value: unknown) {
  if (value == null) return {value: 0, suffix: '', string: false};
  if (typeof value === 'number') return Number.isFinite(value) ? {value, suffix: '', string: false} : null;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(px)?$/i);
  return match ? {value: Number(match[1]), suffix: match[2] ?? '', string: true} : null;
}

function svgTransformMatrix(element: SVGGraphicsElement) {
  let matrix = new DOMMatrix();
  const transforms = element.transform.baseVal;
  for (let i = 0; i < transforms.numberOfItems; i++)
    matrix = matrix.multiply(DOMMatrix.fromMatrix(transforms.getItem(i).matrix));
  return matrix;
}

function restore(property: BlockProperty | undefined) {
  if (!property) return;
  if (property._saved !== undefined || property._bindingSource) property.revertUpdate();
  else property.updateValue(undefined);
}

function getMoveTarget(block: Block, element: Element): MoveTarget | null {
  if (block._destroyed || !element.isConnected) return null;
  const computed = element.ownerDocument.defaultView.getComputedStyle(element);
  if (computed.position !== 'absolute') return null;
  const property = block.getProperty('style', false);
  const helper = property?._helperProperty?.getValue();
  const ownHelper =
    helper instanceof Block && helper.getParent() === block && helper.getValue('#is') === 'html:create-style';
  if (!ownHelper && (property?._bindingPath != null || property?._bindingSource)) return null;
  const saved = property?._saved;
  if (!ownHelper && saved != null && (typeof saved !== 'object' || Array.isArray(saved) || saved instanceof Block))
    return null;
  const value = block.getValue('style');
  const style: Record<string, unknown> = value && typeof value === 'object' ? {...value} : {};
  const defined = (name: string) => {
    const prop = ownHelper && helper.getProperty(name, false);
    return style[name] != null || (prop && (prop._saved !== undefined || prop._bindingPath != null));
  };
  const x = !defined('left') && defined('right') ? 'right' : 'left';
  const y = !defined('top') && defined('bottom') ? 'bottom' : 'top';
  const optionalValue = ownHelper && helper.getValue('#optional');
  const optional: string[] = Array.isArray(optionalValue) ? optionalValue.slice() : [];
  const addOptional = !optional.includes(x) || !optional.includes(y);
  if (!optional.includes(x)) optional.push(x);
  if (!optional.includes(y)) optional.push(y);
  return {
    block,
    helper: ownHelper ? helper : null,
    createHelper: !ownHelper && saved == null,
    style,
    x,
    y,
    left: parseFloat(computed[x]) || 0,
    top: parseFloat(computed[y]) || 0,
    optional,
    addOptional,
  };
}

function getSvgMoveTarget(block: Block, element: Element, startX: number, startY: number): SvgMoveTarget | null {
  if (
    block._destroyed ||
    block.getValue('@d-lock') ||
    !(element instanceof SVGGraphicsElement) ||
    !(element.parentElement instanceof SVGGraphicsElement) ||
    !element.isConnected
  )
    return null;
  const parentMatrix = element.parentElement.getScreenCTM();
  if (!parentMatrix) return null;
  const position = svgPositionAttributes[element.localName];
  const names = position?.flat();
  const pointsElement = element instanceof SVGPolylineElement || element instanceof SVGPolygonElement;
  const transform = svgTransformMatrix(element);
  const inverse = getPlaneInverse(
    DOMMatrix.fromMatrix(parentMatrix).multiply(names || pointsElement ? transform : new DOMMatrix())
  );
  const start = inverse && projectPoint(inverse, startX, startY);
  if (!start) return null;
  const targetNames = names ?? [pointsElement ? 'points' : 'transform'];
  const values: SvgMoveTarget['values'] = [];
  for (const [index, name] of targetNames.entries()) {
    const property = block.getProperty(name, false);
    if (property?._bindingPath != null || property?._bindingSource) return null;
    if (names) {
      const number = svgNumber(block.getValue(name));
      if (!number) return null;
      values.push({name, axis: index % 2 ? 'y' : 'x', ...number});
    }
  }
  let points: SvgMoveTarget['points'];
  if (pointsElement) {
    if (typeof block.getValue('points') !== 'string') return null;
    points = [];
    for (let i = 0; i < element.points.numberOfItems; i++) {
      const point = element.points.getItem(i);
      points.push({x: point.x, y: point.y});
    }
    if (!points.length) return null;
  }
  const optionalValue = block.getValue('#optional');
  const optional = Array.isArray(optionalValue) ? optionalValue : [];
  const additions = targetNames.filter((name) => !optional.includes(name));
  const optionalProperty = block.getProperty('#optional', false);
  if (additions.length && (optionalProperty?._bindingPath != null || optionalProperty?._bindingSource)) return null;
  return {
    block,
    inverse,
    start,
    values,
    points,
    transform: names || pointsElement ? undefined : transform,
    optional,
    additions,
  };
}

function createSvgStageMove(
  block: Block,
  element: Element,
  selected: Block[],
  elementMap: ElementMap,
  startX: number,
  startY: number
) {
  const reference = getSvgMoveTarget(block, element, startX, startY);
  if (!reference) return null;
  const targets = [reference];
  for (const other of selected) {
    if (other === block) continue;
    const otherElement = elementMap.getElements(other)?.find((item) => item.isConnected);
    const target = otherElement && getSvgMoveTarget(other, otherElement, startX, startY);
    if (target) targets.push(target);
  }
  let values: {target: SvgMoveTarget; changed: Record<string, number | string>; moved: boolean}[] = [];
  const cancel = () => {
    for (const {block, values, points, transform, additions} of targets) {
      if (block._destroyed) continue;
      for (const {name} of values) restore(block.getProperty(name, false));
      if (points) restore(block.getProperty('points', false));
      if (transform) restore(block.getProperty('transform', false));
      if (additions.length) restore(block.getProperty('#optional', false));
    }
  };
  return {
    update(screenX: number, screenY: number) {
      values = [];
      for (const target of targets) {
        const {block, inverse, start, optional, additions} = target;
        if (block._destroyed) continue;
        const point = projectPoint(inverse, startX + screenX, startY + screenY);
        if (!point) continue;
        const dx = point.x - start.x;
        const dy = point.y - start.y;
        const changed: Record<string, number | string> = {};
        for (const {name, axis, value, suffix, string} of target.values) {
          const next = value + (axis === 'y' ? dy : dx);
          changed[name] = string ? `${next}${suffix}` : next;
        }
        if (target.points) changed.points = target.points.map(({x, y}) => `${x + dx},${y + dy}`).join(' ');
        if (target.transform) {
          const {a, b, c, d, e, f} = target.transform;
          changed.transform = `matrix(${a} ${b} ${c} ${d} ${e + dx} ${f + dy})`;
        }
        if (additions.length) block.updateValue('#optional', [...optional, ...additions]);
        for (const [name, value] of Object.entries(changed)) block.updateValue(name, value);
        values.push({target, changed, moved: Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9});
      }
    },
    commit() {
      if (!values.some(({moved}) => moved)) {
        cancel();
        return false;
      }
      for (const {target, changed} of values) {
        const {block, optional, additions} = target;
        if (block._destroyed) continue;
        if (additions.length) block.setValue('#optional', [...optional, ...additions]);
        for (const [name, value] of Object.entries(changed)) block.setValue(name, value);
      }
      return true;
    },
    cancel,
  };
}

/** A gesture previews runtime values, then either saves them or restores their sources. */
export function createStageMove(
  block: Block,
  element: Element,
  selected: Block[],
  elementMap: ElementMap,
  startX: number,
  startY: number
) {
  if (element instanceof SVGGraphicsElement && element.parentElement instanceof SVGGraphicsElement)
    return createSvgStageMove(block, element, selected, elementMap, startX, startY);
  const reference = getMoveTarget(block, element);
  if (!reference || !element.parentElement) return null;
  const geometry = getStageElementGeometry(element, undefined, true);
  if (!geometry) return null;
  const inverse = getPlaneInverse(geometry.matrix);
  const local = inverse && projectPoint(inverse, startX, startY);
  if (!local) return null;
  const anchor = geometry.matrix.transformPoint(local);
  const w = geometry.transform?.transformPoint(local).w ?? 1;
  const position = geometry.positionMatrix;
  // CSS inset changes translate the grabbed point before its own transform.
  // Keeping that point's depth/w makes perspective dragging follow the pointer.
  const matrix = getPlaneInverse(
    new DOMMatrix([
      position.m11 * w,
      position.m12 * w,
      0,
      position.m14 * w,
      position.m21 * w,
      position.m22 * w,
      0,
      position.m24 * w,
      0,
      0,
      1,
      0,
      anchor.x,
      anchor.y,
      0,
      anchor.w,
    ])
  );
  if (!matrix) return null;
  const targets = [reference];
  for (const other of selected) {
    if (other === block) continue;
    const otherElement = elementMap.getElements(other)?.find((item) => item.isConnected);
    const target = otherElement && getMoveTarget(other, otherElement);
    if (target) targets.push(target);
  }
  let dx = 0;
  let dy = 0;
  const positions = (target: MoveTarget) => ({
    [target.x]: target.left + (target.x === 'right' ? -dx : dx),
    [target.y]: target.top + (target.y === 'bottom' ? -dy : dy),
  });
  const cancel = () => {
    for (const {block, helper, x, y, addOptional} of targets) {
      if (block._destroyed || helper?._destroyed) continue;
      if (helper) {
        if (addOptional) restore(helper.getProperty('#optional', false));
        restore(helper.getProperty(x, false));
        restore(helper.getProperty(y, false));
      } else {
        restore(block.getProperty('style', false));
      }
    }
  };
  return {
    update(screenX: number, screenY: number) {
      const delta = projectPoint(matrix, startX + screenX, startY + screenY);
      if (!delta) return;
      dx = Math.abs(delta.x) < 1e-9 ? 0 : delta.x;
      dy = Math.abs(delta.y) < 1e-9 ? 0 : delta.y;
      for (const target of targets) {
        const {block, helper, optional, addOptional} = target;
        if (block._destroyed || helper?._destroyed) continue;
        const values = positions(target);
        if (helper) {
          if (addOptional) helper.updateValue('#optional', optional);
          for (const [name, value] of Object.entries(values)) helper.updateValue(name, value);
        } else {
          block.updateValue('style', {...target.style, ...values});
        }
      }
    },
    commit() {
      if (dx === 0 && dy === 0) {
        cancel();
        return false;
      }
      let changed = false;
      for (const target of targets) {
        const {block, style, optional, addOptional} = target;
        let {helper} = target;
        if (block._destroyed || helper?._destroyed) continue;
        const values = positions(target);
        if (target.createHelper) {
          helper = block.createHelperBlock('style');
          helper.setValue('#is', 'html:create-style');
        }
        if (helper) {
          if (addOptional) helper.setValue('#optional', optional);
          for (const [name, value] of Object.entries(values)) helper.setValue(name, value);
        } else {
          block.setValue('style', {...style, ...values});
        }
        changed = true;
      }
      return changed;
    },
    cancel,
  };
}
