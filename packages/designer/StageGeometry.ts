import {getElementGeometry, type ElementGeometry} from '@ticlo/html';

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

/** Measure an outer SVG's CSS box, excluding the viewBox transform from its SVG CTM. */
export function getStageElementGeometry(
  element: Element,
  root?: HTMLElement,
  includePosition = false
): ElementGeometry | null {
  const htmlGeometry = getElementGeometry([element], root).get(element);
  if (htmlGeometry || !(element instanceof SVGSVGElement) || !(element.parentElement instanceof HTMLElement))
    return htmlGeometry;

  const computed = element.ownerDocument.defaultView.getComputedStyle(element);
  const width = parseFloat(computed.width);
  const height = parseFloat(computed.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || !width || !height) return null;
  const insetX = (parseFloat(computed.borderLeftWidth) || 0) + (parseFloat(computed.paddingLeft) || 0);
  const insetY = (parseFloat(computed.borderTopWidth) || 0) + (parseFloat(computed.paddingTop) || 0);
  const boxWidth =
    width +
    (computed.boxSizing === 'border-box'
      ? 0
      : insetX + (parseFloat(computed.paddingRight) || 0) + (parseFloat(computed.borderRightWidth) || 0));
  const boxHeight =
    height +
    (computed.boxSizing === 'border-box'
      ? 0
      : insetY + (parseFloat(computed.paddingBottom) || 0) + (parseFloat(computed.borderBottomWidth) || 0));
  const boxMatrix = () => {
    const screen = element.getScreenCTM();
    const local = element.getCTM();
    const inverse = local && getPlaneInverse(DOMMatrix.fromMatrix(local));
    return screen && inverse ? DOMMatrix.fromMatrix(screen).multiply(inverse).translate(-insetX, -insetY) : null;
  };
  const viewportMatrix = boxMatrix();
  if (!viewportMatrix) return null;

  let viewportPosition = viewportMatrix;
  const transformed = ['transform', 'translate', 'rotate', 'scale'].some(
    (name) => computed.getPropertyValue(name) !== 'none'
  );
  if (transformed && includePosition) {
    const names = ['transform', 'translate', 'rotate', 'scale'];
    const saved = names.map((name) => [element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]);
    try {
      for (const name of names) element.style.setProperty(name, 'none', 'important');
      viewportPosition = boxMatrix();
    } finally {
      names.forEach((name, index) => element.style.setProperty(name, saved[index][0], saved[index][1]));
    }
    if (!viewportPosition) return null;
  }

  const rootMatrix = root && getElementGeometry([root]).get(root)?.matrix;
  const rootInverse = root ? rootMatrix && getPlaneInverse(rootMatrix) : null;
  if (root && !rootInverse) return null;
  const matrix = rootInverse ? rootInverse.multiply(viewportMatrix) : viewportMatrix;
  const positionMatrix = rootInverse ? rootInverse.multiply(viewportPosition) : viewportPosition;
  const positionInverse = getPlaneInverse(positionMatrix);
  if (!positionInverse) return null;
  const transform = transformed && includePosition ? positionInverse.multiply(matrix) : null;
  const corners = [
    projectPoint(matrix, 0, 0),
    projectPoint(matrix, boxWidth, 0),
    projectPoint(matrix, boxWidth, boxHeight),
    projectPoint(matrix, 0, boxHeight),
  ];
  if (corners.some((corner) => !corner)) return null;
  return {matrix, positionMatrix, transform, quad: new DOMQuad(corners[0], corners[1], corners[2], corners[3])};
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
