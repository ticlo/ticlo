export interface ElementGeometry {
  quad: DOMQuad;
  /** Border-box coordinates to the requested coordinate space. */
  matrix: DOMMatrix;
  /** The same mapping before the element's own CSS transform is applied. */
  positionMatrix: DOMMatrix;
  transform: DOMMatrix | null;
}

interface Geometry {
  element: HTMLElement;
  parent: Geometry | null;
  style: CSSStyleDeclaration;
  width: number;
  height: number;
  borderLeft: number;
  borderTop: number;
  zoom: number;
  scrollX: number;
  scrollY: number;
  x: number;
  y: number;
  matrix: DOMMatrix;
  positionMatrix: DOMMatrix;
  transform: DOMMatrix | null;
  childrenMatrix?: DOMMatrix | null;
  absoluteContainer?: Geometry | null;
  fixedContainer?: Geometry | null;
}

function values(value: string) {
  return value.match(/calc\([^)]*\)|[^\s]+/g) ?? [];
}

function length(value: string, reference = 0): number {
  if (!value) return 0;
  if (value.startsWith('calc(')) {
    const expression = value.slice(5, -1).replaceAll(' ', '');
    const terms: string[] = expression.match(/[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?(?:px|%)/gi) ?? [];
    if (terms.join('') !== expression) return NaN;
    return terms.reduce((sum, term) => sum + length(term, reference), 0);
  }
  const number = parseFloat(value);
  if (value.endsWith('%')) return (number * reference) / 100;
  return value.endsWith('px') || Number(value) === 0 ? number : NaN;
}

function angle(value: string) {
  const number = parseFloat(value);
  if (value.endsWith('grad')) return number * 0.9;
  if (value.endsWith('rad')) return (number * 180) / Math.PI;
  if (value.endsWith('turn')) return number * 360;
  return number;
}

function createsContainer(style: CSSStyleDeclaration) {
  return (
    style.transform !== 'none' ||
    style.translate !== 'none' ||
    style.rotate !== 'none' ||
    style.scale !== 'none' ||
    style.perspective !== 'none' ||
    preserves3D(style) ||
    style.filter !== 'none' ||
    style.backdropFilter !== 'none' ||
    /(?:layout|paint|strict|content)/.test(style.contain) ||
    style.contentVisibility === 'auto' ||
    /(?:transform|translate|rotate|scale|perspective|filter|backdrop-filter|contain)/.test(style.willChange)
  );
}

function preserves3D(style: CSSStyleDeclaration) {
  // Grouping values force the *used* transform-style to flat, even though
  // getComputedStyle still returns preserve-3d.
  return (
    style.transformStyle === 'preserve-3d' &&
    ['visible', 'clip'].includes(style.overflowX) &&
    ['visible', 'clip'].includes(style.overflowY) &&
    Number(style.opacity) === 1 &&
    style.filter === 'none' &&
    style.backdropFilter === 'none' &&
    !/(?:opacity|filter|backdrop-filter)/.test(style.willChange) &&
    style.clip === 'auto' &&
    style.clipPath === 'none' &&
    style.isolation !== 'isolate' &&
    style.maskImage === 'none' &&
    (!style.getPropertyValue('mask-border-source') || style.getPropertyValue('mask-border-source') === 'none') &&
    style.mixBlendMode === 'normal' &&
    !/(?:paint|strict|content)/.test(style.contain) &&
    style.contentVisibility === 'visible'
  );
}

function ownTransform(geometry: Geometry, Matrix: typeof DOMMatrix) {
  const {style, width, height} = geometry;
  if (style.transform === 'none' && style.translate === 'none' && style.rotate === 'none' && style.scale === 'none')
    return null;

  const matrix = new Matrix();
  if (style.translate !== 'none') {
    const parts = values(style.translate);
    matrix.translateSelf(length(parts[0], width), length(parts[1], height), length(parts[2]));
  }
  if (style.rotate !== 'none') {
    const parts = values(style.rotate);
    const degrees = angle(parts.at(-1));
    if (parts.length === 1) matrix.rotateSelf(degrees);
    else {
      const axis = parts.length === 2 ? ['x', 'y', 'z'].map((name) => Number(name === parts[0])) : parts.map(Number);
      matrix.rotateAxisAngleSelf(axis[0], axis[1], axis[2], degrees);
    }
  }
  if (style.scale !== 'none') {
    const parts = values(style.scale).map((value) => parseFloat(value) / (value.endsWith('%') ? 100 : 1));
    matrix.scaleSelf(parts[0], parts[1] ?? parts[0], parts[2] ?? 1);
  }
  if (style.transform !== 'none') matrix.multiplySelf(new Matrix(style.transform));
  if (matrix.is2D && matrix.a === 1 && matrix.b === 0 && matrix.c === 0 && matrix.d === 1) return matrix;
  const origin = values(style.transformOrigin);
  const ox = length(origin[0], width);
  const oy = length(origin[1], height);
  const oz = length(origin[2]);
  return new Matrix().translateSelf(ox, oy, oz).multiplySelf(matrix).translateSelf(-ox, -oy, -oz);
}

function boxQuad(matrix: DOMMatrix, width: number, height: number, Quad: typeof DOMQuad) {
  const x = matrix.m11 * width;
  const y = matrix.m12 * width;
  const u = matrix.m21 * height;
  const v = matrix.m22 * height;
  const e = matrix.m41;
  const f = matrix.m42;
  const w = matrix.m44;
  const wx = matrix.m14 * width;
  const wy = matrix.m24 * height;
  const project = (x: number, y: number, w: number) => {
    // Crossing the perspective plane needs clipping rather than four corners.
    x /= w;
    y /= w;
    return w > 0 && Number.isFinite(x) && Number.isFinite(y) ? {x, y} : null;
  };
  const p1 = project(e, f, w);
  const p2 = project(e + x, f + y, w + wx);
  const p3 = project(e + x + u, f + y + v, w + wx + wy);
  const p4 = project(e + u, f + v, w + wy);
  return p1 && p2 && p3 && p4 ? new Quad(p1, p2, p3, p4) : null;
}

/**
 * Measures single HTML border boxes in root's local border-box coordinates.
 * Root's own transform/zoom and all ancestors above it are excluded; its scroll
 * and perspective on children are included. No DOM is inserted or modified.
 *
 * Shared ancestors, layout offsets, and accumulated child matrices are measured
 * once per call. There is no cache between calls. Includes 2D/3D transforms,
 * individual transform properties, perspective, CSS zoom, and scrolling.
 *
 * Inputs must have a single layout box. Each unique input has an entry.
 * Null means no supported box within root: detached/display:none elements,
 * SVG, inline/display:contents boxes, motion paths,
 * non-border transform reference boxes, shadow boundaries, ambiguous 3D paint
 * containment, or positioning whose containing block is outside root.
 * Native integer layout offsets can introduce subpixel rounding for in-flow boxes.
 * Quads describe the full border box, without overflow/clip-path occlusion.
 */
export function getElementBoxQuads(elements: readonly Element[], root: HTMLElement): Map<Element, DOMQuad | null> {
  return new Map(
    [...getElementGeometry(elements, root)].map(([element, geometry]) => [element, geometry?.quad ?? null])
  );
}

/**
 * Batch geometry and position matrices. With root, uses its local border-box
 * space, just like getElementBoxQuads. Without root, uses client coordinates,
 * including document scrolling and every ancestor's transform/zoom.
 */
export function getElementGeometry(
  elements: readonly Element[],
  root?: HTMLElement
): Map<Element, ElementGeometry | null> {
  const result = new Map<Element, ElementGeometry | null>();
  if (!elements.length) return result;
  const document = (root ?? elements[0]).ownerDocument;
  const viewport = !root;
  root ??= document.documentElement;
  const view = document.defaultView;
  if (!view || !root.isConnected || !root.getClientRects().length) {
    for (const element of elements) result.set(element, null);
    return result;
  }
  const {DOMMatrix: Matrix, DOMQuad: Quad, HTMLElement: HtmlElement} = view;
  const cache = new Map<Element, Geometry | null>();

  function containingBlock(geometry: Geometry, fixed: boolean): Geometry | null {
    const key = fixed ? 'fixedContainer' : 'absoluteContainer';
    if (key in geometry) return geometry[key];
    const container =
      (!fixed && (geometry.style.position !== 'static' || (viewport && geometry.element === root))) ||
      createsContainer(geometry.style);
    return (geometry[key] = container ? geometry : geometry.parent && containingBlock(geometry.parent, fixed));
  }

  function childrenMatrix(geometry: Geometry) {
    if ('childrenMatrix' in geometry) return geometry.childrenMatrix;
    const {matrix, style, element} = geometry;
    // Browsers disagree about paint containment flattening preserve-3d. Avoid
    // claiming a quad when that boundary can affect the projected coordinates.
    if (
      style.transformStyle === 'preserve-3d' &&
      /(?:paint|strict|content)/.test(style.contain) &&
      (matrix.m31 || matrix.m32 || matrix.m34)
    )
      return (geometry.childrenMatrix = null);
    const children = Matrix.fromMatrix(matrix);
    if (!preserves3D(style)) {
      // Only the final x/y/w matter. Discard input depth at a flat boundary,
      // keeping the ordinary 2D path a 2D matrix.
      children.m31 = 0;
      children.m32 = 0;
      children.m34 = 0;
    }
    if (style.perspective !== 'none') {
      const origin = values(style.perspectiveOrigin);
      const x = length(origin[0], geometry.width);
      const y = length(origin[1], geometry.height);
      const perspective = new Matrix();
      perspective.m34 = -1 / Math.max(1, length(style.perspective));
      children.translateSelf(x, y).multiplySelf(perspective).translateSelf(-x, -y);
    }
    // The viewport root's bounding rectangle already contains document scroll.
    if (!viewport || element !== document.scrollingElement)
      children.translateSelf(-element.scrollLeft, -element.scrollTop);
    geometry.childrenMatrix = children;
    return children;
  }

  function measure(element: Element): Geometry | null {
    if (cache.has(element)) return cache.get(element);
    cache.set(element, null);
    if (!(element instanceof HtmlElement) || !root.contains(element) || element.assignedSlot) return null;
    const parent = element === root ? null : element.parentElement && measure(element.parentElement);
    if (element !== root && !parent) return null;
    const style = view.getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.display === 'contents' ||
      style.display === 'inline' ||
      ((element !== root || viewport) &&
        (style.offsetPath !== 'none' ||
          (style.offsetPosition !== 'normal' && style.offsetPosition !== 'auto') ||
          ((style.transformBox === 'content-box' || style.transformBox === 'fill-box') &&
            (style.transform !== 'none' ||
              style.translate !== 'none' ||
              style.rotate !== 'none' ||
              style.scale !== 'none'))))
    )
      return null;

    const borderLeft = length(style.borderLeftWidth);
    const borderTop = length(style.borderTopWidth);
    let width = length(style.width);
    let height = length(style.height);
    if (style.boxSizing !== 'border-box') {
      width += borderLeft + length(style.borderRightWidth) + length(style.paddingLeft) + length(style.paddingRight);
      height += borderTop + length(style.borderBottomWidth) + length(style.paddingTop) + length(style.paddingBottom);
    }
    if (!Number.isFinite(width)) width = element.offsetWidth;
    if (!Number.isFinite(height)) height = element.offsetHeight;
    const zoom = (parent?.zoom ?? 1) * (parent || viewport ? parseFloat(style.zoom) || 1 : 1);
    const geometry: Geometry = {
      element,
      parent,
      style,
      width,
      height,
      borderLeft,
      borderTop,
      zoom,
      scrollX: (parent?.scrollX ?? 0) + element.scrollLeft * zoom,
      scrollY: (parent?.scrollY ?? 0) + element.scrollTop * zoom,
      x: 0,
      y: 0,
      matrix: new Matrix(),
      positionMatrix: new Matrix(),
      transform: null,
    };
    if (parent) {
      let ignoredScrollX = 0;
      let ignoredScrollY = 0;
      if (style.position === 'absolute' || style.position === 'fixed') {
        const containing = containingBlock(parent, style.position === 'fixed');
        if (!containing) return null;
        // Scrollers between an out-of-flow child and its containing block do
        // not scroll that child. Their transforms/zoom still belong to its path.
        ignoredScrollX = parent.scrollX - containing.scrollX;
        ignoredScrollY = parent.scrollY - containing.scrollY;
        geometry.x =
          containing.x +
          containing.borderLeft * containing.zoom +
          (length(style.left) + length(style.marginLeft)) * geometry.zoom;
        geometry.y =
          containing.y +
          containing.borderTop * containing.zoom +
          (length(style.top) + length(style.marginTop)) * geometry.zoom;
      } else {
        const offset = element.offsetParent ?? (viewport && element === document.body ? root : null);
        const offsetParent = offset && measure(offset);
        if (!offsetParent) return null;
        geometry.x = offsetParent.x + offsetParent.borderLeft * offsetParent.zoom + element.offsetLeft * geometry.zoom;
        geometry.y = offsetParent.y + offsetParent.borderTop * offsetParent.zoom + element.offsetTop * geometry.zoom;
      }
      const parentMatrix = childrenMatrix(parent);
      if (!parentMatrix) return null;
      const matrix = parentMatrix.translate(
        (geometry.x - parent.x + ignoredScrollX) / parent.zoom,
        (geometry.y - parent.y + ignoredScrollY) / parent.zoom
      );
      const zoom = geometry.zoom / parent.zoom;
      if (zoom !== 1) matrix.scaleSelf(zoom, zoom, zoom);
      geometry.positionMatrix = matrix;
      geometry.transform = ownTransform(geometry, Matrix);
      geometry.matrix = geometry.transform ? matrix.multiply(geometry.transform) : matrix;
    } else if (viewport) {
      geometry.positionMatrix = new Matrix().scaleSelf(zoom, zoom, zoom);
      geometry.transform = ownTransform(geometry, Matrix);
      geometry.matrix = geometry.transform
        ? geometry.positionMatrix.multiply(geometry.transform)
        : geometry.positionMatrix;
      const quad = boxQuad(geometry.matrix, width, height, Quad);
      if (!quad) return null;
      const predicted = quad.getBounds();
      const actual = element.getBoundingClientRect();
      // The document element has no transformed ancestor. Align its projected
      // box once to recover viewport translation, including page scrolling.
      const alignment = new Matrix().translateSelf(actual.left - predicted.left, actual.top - predicted.top);
      geometry.matrix = alignment.multiply(geometry.matrix);
      geometry.positionMatrix = alignment.multiply(geometry.positionMatrix);
    }
    if (![geometry.x, geometry.y, width, height].every(Number.isFinite)) return null;
    cache.set(element, geometry);
    return geometry;
  }

  for (const element of elements) {
    if (result.has(element)) continue;
    const geometry = measure(element);
    const quad = geometry && boxQuad(geometry.matrix, geometry.width, geometry.height, Quad);
    result.set(
      element,
      quad
        ? {
            quad,
            matrix: geometry.matrix,
            positionMatrix: geometry.positionMatrix,
            transform: geometry.transform,
          }
        : null
    );
  }
  return result;
}
