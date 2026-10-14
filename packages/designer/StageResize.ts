import {Block, type BlockProperty} from '@ticlo/core';
import type {PointerEvent} from 'react';
import {getElementGeometry} from '@ticlo/html';
import {getPlaneInverse, projectPoint} from './StageGeometry.ts';

export const resizeHandles = [
  {name: 'top-left', x: -1, y: -1},
  {name: 'top', x: 0, y: -1},
  {name: 'top-right', x: 1, y: -1},
  {name: 'right', x: 1, y: 0},
  {name: 'bottom-right', x: 1, y: 1},
  {name: 'bottom', x: 0, y: 1},
  {name: 'bottom-left', x: -1, y: 1},
  {name: 'left', x: -1, y: 0},
] as const;

export type ResizeHandle = (typeof resizeHandles)[number];
export interface ResizePreview {
  element: Element;
  quad: DOMQuad;
}
export type ResizeStart = (element: Element, handle: ResizeHandle, event: PointerEvent) => void;

function restore(property: BlockProperty | undefined) {
  if (!property) return;
  if (property._saved !== undefined || property._bindingSource) property.revertUpdate();
  else property.updateValue(undefined);
}

/** Cache the gesture's coordinate space independently of subsequent layout changes. */
export function createStageResize(
  block: Block,
  element: Element,
  stage: HTMLElement,
  handle: ResizeHandle,
  startX: number,
  startY: number
) {
  if (block._destroyed || block.getValue('@d-lock') || !(element instanceof HTMLElement) || !element.isConnected)
    return null;
  const property = block.getProperty('style', false);
  const helperValue = property?._helperProperty?.getValue();
  const helper =
    helperValue instanceof Block &&
    helperValue.getParent() === block &&
    helperValue.getValue('#is') === 'html:create-style'
      ? helperValue
      : null;
  if (!helper && (property?._bindingPath != null || property?._bindingSource)) return null;
  const saved = property?._saved;
  if (!helper && saved != null && (typeof saved !== 'object' || Array.isArray(saved) || saved instanceof Block))
    return null;
  const value = block.getValue('style');
  const style: Record<string, unknown> = value && typeof value === 'object' ? {...value} : {};
  const defined = (name: string) => {
    const prop = helper?.getProperty(name, false);
    return (
      (style[name] != null && style[name] !== 'auto') ||
      (prop && (prop._saved !== undefined || prop._bindingPath != null) && prop.getValue() !== 'auto')
    );
  };
  const computed = element.ownerDocument.defaultView.getComputedStyle(element);
  const width = parseFloat(computed.width);
  const height = parseFloat(computed.height);
  const paddingX =
    computed.boxSizing === 'border-box'
      ? 0
      : parseFloat(computed.paddingLeft) +
        parseFloat(computed.paddingRight) +
        parseFloat(computed.borderLeftWidth) +
        parseFloat(computed.borderRightWidth);
  const paddingY =
    computed.boxSizing === 'border-box'
      ? 0
      : parseFloat(computed.paddingTop) +
        parseFloat(computed.paddingBottom) +
        parseFloat(computed.borderTopWidth) +
        parseFloat(computed.borderBottomWidth);
  if (![width, height, paddingX, paddingY].every(Number.isFinite)) return null;
  const boxWidth = width + paddingX;
  const boxHeight = height + paddingY;
  const absolute = computed.position === 'absolute';
  const left = absolute && defined('left');
  const right = absolute && defined('right');
  const top = absolute && defined('top');
  const bottom = absolute && defined('bottom');
  const insets = {
    left: parseFloat(computed.left) || 0,
    right: parseFloat(computed.right) || 0,
    top: parseFloat(computed.top) || 0,
    bottom: parseFloat(computed.bottom) || 0,
  };
  const geometry = getElementGeometry([element]).get(element);
  const stageGeometry = getElementGeometry([element], stage).get(element);
  const inverse = geometry && getPlaneInverse(geometry.matrix);
  const start = inverse && projectPoint(inverse, startX, startY);
  if (!start || !stageGeometry) return null;
  const anchorX = ((1 - handle.x) * boxWidth) / 2;
  const anchorY = ((1 - handle.y) * boxHeight) / 2;
  const anchor = projectPoint(geometry.matrix, anchorX, anchorY);
  if (!anchor) return null;
  const offsetX = stage.scrollLeft - stage.clientLeft;
  const offsetY = stage.scrollTop - stage.clientTop;
  const optionalValue = helper?.getValue('#optional');
  const optional: string[] = Array.isArray(optionalValue) ? optionalValue.slice() : [];
  const fields = new Set<string>();
  let addedOptional = false;
  let values: Record<string, number> = {};
  let dw = 0;
  let dh = 0;
  const preview = () => {
    const x = handle.x < 0 ? -dw : 0;
    const y = handle.y < 0 ? -dh : 0;
    const points = [
      [x, y],
      [x + boxWidth + dw, y],
      [x + boxWidth + dw, y + boxHeight + dh],
      [x, y + boxHeight + dh],
    ].map(([x, y]) => projectPoint(stageGeometry.matrix, x, y));
    return points.every(Boolean)
      ? {element, quad: new DOMQuad(...points.map(({x, y}) => ({x: x + offsetX, y: y + offsetY})))}
      : null;
  };
  const cancel = () => {
    if (block._destroyed || helper?._destroyed) return;
    if (helper) {
      if (addedOptional) restore(helper.getProperty('#optional', false));
      for (const name of fields) restore(helper.getProperty(name, false));
    } else restore(block.getProperty('style', false));
  };
  return {
    preview,
    update(screenX: number, screenY: number) {
      const point = projectPoint(inverse, startX + screenX, startY + screenY);
      if (!point || block._destroyed || helper?._destroyed) return null;
      dw = handle.x ? Math.max(-width, handle.x * (point.x - start.x)) : 0;
      dh = handle.y ? Math.max(-height, handle.y * (point.y - start.y)) : 0;
      if (Math.abs(dw) < 1e-9) dw = 0;
      if (Math.abs(dh) < 1e-9) dh = 0;
      values = {};
      if (handle.x && !(left && right)) values.width = width + dw;
      if (handle.y && !(top && bottom)) values.height = height + dh;
      if (absolute && (left || right || top || bottom)) {
        let transform = geometry.transform;
        if (transform) {
          // Resolve size-dependent CSS transforms/origins using the browser. Restore
          // inline dimensions immediately; persistent edits still go through Blocks.
          const savedWidth = element.style.getPropertyValue('width');
          const savedHeight = element.style.getPropertyValue('height');
          const widthPriority = element.style.getPropertyPriority('width');
          const heightPriority = element.style.getPropertyPriority('height');
          try {
            element.style.width = `${width + dw}px`;
            element.style.height = `${height + dh}px`;
            const resized = getElementGeometry([element], stage).get(element);
            if (!resized) return null;
            transform = resized.transform;
          } finally {
            element.style.setProperty('width', savedWidth, widthPriority);
            element.style.setProperty('height', savedHeight, heightPriority);
          }
        }
        const localAnchor = new DOMPoint(
          ((1 - handle.x) * (boxWidth + dw)) / 2,
          ((1 - handle.y) * (boxHeight + dh)) / 2
        );
        const ownAnchor = transform ? transform.transformPoint(localAnchor) : localAnchor;
        const projected = geometry.positionMatrix.transformPoint(ownAnchor);
        const p = geometry.positionMatrix;
        const w = ownAnchor.w;
        const positionInverse = getPlaneInverse(
          new DOMMatrix([
            p.m11 * w,
            p.m12 * w,
            0,
            p.m14 * w,
            p.m21 * w,
            p.m22 * w,
            0,
            p.m24 * w,
            0,
            0,
            1,
            0,
            projected.x,
            projected.y,
            0,
            projected.w,
          ])
        );
        const shift = positionInverse && projectPoint(positionInverse, anchor.x, anchor.y);
        if (!shift) return null;
        if (left && (handle.x || fields.has('left') || Math.abs(shift.x) > 1e-9)) values.left = insets.left + shift.x;
        if (right && (handle.x || fields.has('right') || Math.abs(shift.x) > 1e-9))
          values.right = insets.right - shift.x - dw;
        if (top && (handle.y || fields.has('top') || Math.abs(shift.y) > 1e-9)) values.top = insets.top + shift.y;
        if (bottom && (handle.y || fields.has('bottom') || Math.abs(shift.y) > 1e-9))
          values.bottom = insets.bottom - shift.y - dh;
      }
      for (const name of Object.keys(values)) fields.add(name);
      if (helper) {
        const nextOptional = [...optional, ...[...fields].filter((name) => !optional.includes(name))];
        if (nextOptional.length !== optional.length) {
          addedOptional = true;
          helper.updateValue('#optional', nextOptional);
        }
        for (const [name, value] of Object.entries(values)) helper.updateValue(name, value);
      } else block.updateValue('style', {...style, ...values});
      return preview();
    },
    commit() {
      if ((!dw && !dh) || block._destroyed || helper?._destroyed) {
        cancel();
        return false;
      }
      let target = helper;
      if (!target && saved == null) {
        target = block.createHelperBlock('style');
        target.setValue('#is', 'html:create-style');
      }
      if (target) {
        const nextOptional = [...optional, ...Object.keys(values).filter((name) => !optional.includes(name))];
        if (nextOptional.length !== optional.length) target.setValue('#optional', nextOptional);
        for (const [name, value] of Object.entries(values)) target.setValue(name, value);
      } else block.setValue('style', {...style, ...values});
      return true;
    },
    cancel,
  };
}
