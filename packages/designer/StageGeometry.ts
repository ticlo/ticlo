import {getElementGeometry} from '@ticlo/html';

/** Invert the projected z=0 plane rather than the full 3D matrix. */
export function getPlaneInverse(matrix: DOMMatrix) {
  const inverse = new DOMMatrix([
    matrix.m11,
    matrix.m12,
    0,
    matrix.m14,
    matrix.m21,
    matrix.m22,
    0,
    matrix.m24,
    0,
    0,
    1,
    0,
    matrix.m41,
    matrix.m42,
    0,
    matrix.m44,
  ]).inverse();
  return Array.from(inverse.toFloat64Array()).every(Number.isFinite) ? inverse : null;
}

export function projectPoint(matrix: DOMMatrix, x: number, y: number) {
  const point = matrix.transformPoint({x, y});
  x = point.x / point.w;
  y = point.y / point.w;
  return point.w > 0 && Number.isFinite(x) && Number.isFinite(y) ? {x, y} : null;
}

export function createStagePointMapper(stage: HTMLElement) {
  const geometry = getElementGeometry([stage]).get(stage);
  if (geometry) {
    const inverse = getPlaneInverse(geometry.matrix);
    return (x: number, y: number) => inverse && projectPoint(inverse, x, y);
  }
  // Preserve rectangular feedback for geometry outside the utility's contract.
  const rect = stage.getBoundingClientRect();
  const scaleX = rect.width / stage.offsetWidth || 1;
  const scaleY = rect.height / stage.offsetHeight || 1;
  return (x: number, y: number) => ({x: (x - rect.left) / scaleX, y: (y - rect.top) / scaleY});
}

export function getFallbackQuad(element: Element, toStage: ReturnType<typeof createStagePointMapper>) {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const p1 = toStage(rect.left, rect.top);
  const p2 = toStage(rect.right, rect.top);
  const p3 = toStage(rect.right, rect.bottom);
  const p4 = toStage(rect.left, rect.bottom);
  return p1 && p2 && p3 && p4 ? new DOMQuad(p1, p2, p3, p4) : null;
}

export function quadIntersectsRect(quad: DOMQuad, rect: {left: number; top: number; right: number; bottom: number}) {
  const bounds = quad.getBounds();
  if (
    !bounds.width ||
    !bounds.height ||
    bounds.right <= rect.left ||
    bounds.left >= rect.right ||
    bounds.bottom <= rect.top ||
    bounds.top >= rect.bottom
  )
    return false;
  const points = [quad.p1, quad.p2, quad.p3, quad.p4];
  const corners = [
    {x: rect.left, y: rect.top},
    {x: rect.right, y: rect.top},
    {x: rect.right, y: rect.bottom},
    {x: rect.left, y: rect.bottom},
  ];
  // Separating axes from the quad edges reject empty parts of a rotated box's
  // bounding rectangle. The rectangle's own axes were checked above.
  return points.every((point, i) => {
    const next = points[(i + 1) % 4];
    const x = point.y - next.y;
    const y = next.x - point.x;
    if (!x && !y) return true;
    const a = points.map((point) => point.x * x + point.y * y);
    const b = corners.map((point) => point.x * x + point.y * y);
    return Math.max(...a) > Math.min(...b) && Math.max(...b) > Math.min(...a);
  });
}
