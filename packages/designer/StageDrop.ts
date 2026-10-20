import {Block, isStringArray, type ClientConn, type DataMap, type FunctionDesc} from '@ticlo/core';
import {Namespace} from '@ticlo/core/block/Namespace.ts';
import {getElementBoxQuads, getElementGeometry} from '@ticlo/html';
import type {ElementMap} from '@ticlo/react';
import {getChildren} from '@ticlo/react/hooks/useTicloComp.ts';
import {DragState} from 'rc-dock';
import {createStagePointMapper, getFallbackQuad, getPlaneInverse, projectPoint} from './StageGeometry.ts';

export interface DesignerDropTarget {
  block: Block;
  element: Element;
}

export interface DesignerDropHandlers {
  /** Return true to accept this drag and override child insertion, including on leaf components. */
  onDragOverT?: (event: DragState, target: DesignerDropTarget | null) => boolean;
  /** Return true when the drop was handled. */
  onDropT?: (event: DragState, target: DesignerDropTarget | null) => boolean;
}

export function findStageDropTarget(stage: HTMLElement, elementMap: ElementMap, x: number, y: number) {
  const target = stage.ownerDocument.elementFromPoint(x, y);
  if (!target || !stage.contains(target)) return null;
  const element = elementMap.findElementFromParent(target, stage);
  return element ? {element, block: elementMap.getBlock(element)} : null;
}

function getDesc(block: Block) {
  const id = block.getValue('#is');
  return typeof id === 'string' ? Namespace.getFunctions(id, block._flow)?.listen(id, null)?.getValue()?.desc : null;
}

function pointsForRect(matrix: DOMMatrix, left: number, top: number, width: number, height: number) {
  const points = [
    projectPoint(matrix, left, top),
    projectPoint(matrix, left + width, top),
    projectPoint(matrix, left + width, top + height),
    projectPoint(matrix, left, top + height),
  ];
  return points.every(Boolean) ? points : null;
}

export function getStageChildDrop(
  stage: HTMLElement,
  elementMap: ElementMap,
  conn: ClientConn,
  target: DesignerDropTarget | null,
  x: number,
  y: number
) {
  const scope = conn.getBaseConn();
  const source: DataMap = DragState.getData('blockData', scope);
  const desc: FunctionDesc = DragState.getData('functionDesc', scope);
  if (!source || !desc || source['#is'] !== desc.id || !target) return null;
  const name = (DragState.getData('blockName', scope) || desc.name || desc.id).split('.').pop();
  if (!name) return null;
  let container: DesignerDropTarget;
  for (let element = target.element; element && element !== stage; element = element.parentElement) {
    const block = elementMap.getBlock(element);
    if (block?.getValue('@d-seal')) {
      container = null;
    } else if (!container && block && getDesc(block)?.childrenTags?.some((tag) => desc.tags?.includes(tag))) {
      container = {block, element};
    }
  }
  if (!container) return null;
  const {block, element} = container;
  const order = block.getValue('#order') ?? [];
  if (!isStringArray(order)) return null;
  let index = order.length;
  let data = source;
  let points: {x: number; y: number}[];
  const id = block.getValue('#is');
  if (id === 'react:absolute' || id === 'react:horizontal' || id === 'react:vertical') {
    const geometry = getElementGeometry([element]).get(element);
    const inverse = geometry && getPlaneInverse(geometry.matrix);
    const local = inverse && projectPoint(inverse, x, y);
    const matrix = getElementGeometry([element], stage).get(element)?.matrix;
    if (!local || !matrix || !(element instanceof HTMLElement)) return null;
    if (id === 'react:absolute') {
      const style = source.style as DataMap;
      const width = typeof style?.width === 'number' ? style.width : 100;
      const height = typeof style?.height === 'number' ? style.height : 100;
      const localLeft = local.x - width / 2;
      const localTop = local.y - height / 2;
      const left = localLeft - element.clientLeft + element.scrollLeft;
      const top = localTop - element.clientTop + element.scrollTop;
      data = {
        ...source,
        style: {...style, position: 'absolute', left, top},
      };
      points = pointsForRect(matrix, localLeft, localTop, width, height);
      if (!points) return null;
    } else {
      const children = getChildren(block, order, block.getValue('content')).flatMap((child) => {
        const index = order.findIndex((name) => {
          const value = block.getValue(name);
          return value === child || (name === 'content' && Array.isArray(value) && value.includes(child));
        });
        return child instanceof Block
          ? (elementMap.getElements(child) ?? [])
              .filter((childElement) => element.contains(childElement))
              .map((element) => ({element, index}))
          : [];
      });
      // Static flex children can have an offsetParent outside the container.
      const geometries = getElementGeometry(children.map((child) => child.element));
      const style = stage.ownerDocument.defaultView.getComputedStyle(element);
      const horizontal = style.flexDirection.startsWith('row');
      const reverse = style.flexDirection.endsWith('reverse') !== (horizontal && style.direction === 'rtl');
      let nearest: {rect: DOMRect; index: number};
      let distance = Infinity;
      for (const child of children) {
        const quad = geometries.get(child.element)?.quad;
        if (!quad) continue;
        const corners = [quad.p1, quad.p2, quad.p3, quad.p4].map((point) => projectPoint(inverse, point.x, point.y));
        if (!corners.every(Boolean)) continue;
        const rect = new DOMQuad(corners[0], corners[1], corners[2], corners[3]).getBounds();
        if (!rect || !rect.width || !rect.height) continue;
        const dx = Math.max(rect.left - local.x, 0, local.x - rect.right);
        const dy = Math.max(rect.top - local.y, 0, local.y - rect.bottom);
        const next = dx * dx + dy * dy;
        if (next < distance) {
          distance = next;
          nearest = {rect, index: child.index};
        }
      }
      if (nearest) {
        const {rect} = nearest;
        const before =
          (horizontal ? local.x < rect.left + rect.width / 2 : local.y < rect.top + rect.height / 2) !== reverse;
        // Unordered content follows #order, so new children go before it.
        index = nearest.index < 0 ? order.length : nearest.index + (before ? 0 : 1);
        const leading = nearest.index < 0 ? !reverse : before !== reverse;
        points = horizontal
          ? pointsForRect(matrix, (leading ? rect.left : rect.right) - 3, rect.top, 6, rect.height)
          : pointsForRect(matrix, rect.left, (leading ? rect.top : rect.bottom) - 3, rect.width, 6);
      }
    }
  }
  if (!points) {
    const quad =
      getElementBoxQuads([element], stage).get(element) ?? getFallbackQuad(element, createStagePointMapper(stage));
    if (!quad) return null;
    points = [quad.p1, quad.p2, quad.p3, quad.p4];
  }
  const path = `${block.getFullPath()}.${name}`;
  if (!conn.getEditPolicyView().can({cmd: 'addBlock', path, data, findName: true, orderIndex: index})) return null;
  return {
    ...container,
    path,
    data,
    index,
    points: points
      .map((point) => `${point.x + stage.scrollLeft - stage.clientLeft},${point.y + stage.scrollTop - stage.clientTop}`)
      .join(' '),
  };
}
