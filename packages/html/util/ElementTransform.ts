/**
 * Returns a fresh 2D matrix mapping absolutely positioned children's coordinates
 * to their document's viewport (clientX/clientY), or null if unavailable.
 *
 * Includes ancestor zoom and transforms, excluding the children's own transforms.
 * A child's own CSS zoom must be accounted for separately.
 * Measures synchronously; callers own caching.
 *
 * An array returns one Map entry per unique parent, with null for unavailable
 * matrices. All probes are appended before measurement and removed afterward.
 */
export function getChildrenScreenCTM(parent: Element): DOMMatrix | null;
export function getChildrenScreenCTM(parents: readonly Element[]): Map<Element, DOMMatrix | null>;
export function getChildrenScreenCTM(
  parentOrParents: Element | readonly Element[]
): DOMMatrix | null | Map<Element, DOMMatrix | null> {
  if (!Array.isArray(parentOrParents)) {
    const parent = parentOrParents as Element;
    return getChildrenScreenCTM([parent]).get(parent) ?? null;
  }

  const parents: readonly Element[] = parentOrParents;
  const matrices = new Map<Element, DOMMatrix | null>();
  const probes: {parent: Element; probe: SVGSVGElement; Matrix: typeof DOMMatrix}[] = [];
  try {
    for (const parent of new Set(parents)) {
      matrices.set(parent, null);
      const doc = parent.ownerDocument;
      const view = doc.defaultView;
      if (!parent.isConnected || !view) continue;

      const probe = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      probe.setAttribute('width', '1');
      probe.setAttribute('height', '1');
      probe.style.cssText =
        'all: initial !important; position: absolute !important; left: 0 !important; top: 0 !important; ' +
        'width: 1px !important; height: 1px !important; visibility: hidden !important; pointer-events: none !important;';
      probes.push({parent, probe, Matrix: view.DOMMatrix});
      parent.appendChild(probe);
    }
    for (const {parent, probe, Matrix} of probes) {
      const matrix = probe.getScreenCTM();
      if (matrix) matrices.set(parent, new Matrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]));
    }
    return matrices;
  } finally {
    for (const {probe} of probes) probe.remove();
  }
}
