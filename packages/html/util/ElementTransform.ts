/**
 * Returns a fresh 2D matrix mapping absolutely positioned children's coordinates
 * to their document's viewport (clientX/clientY), or null if unavailable.
 *
 * Includes ancestor zoom and transforms, excluding the children's own transforms.
 * A child's own CSS zoom must be accounted for separately.
 * Measures synchronously; callers own caching.
 */
export function getChildrenScreenCTM(parent: Element): DOMMatrix | null {
  const doc = parent.ownerDocument;
  const view = doc.defaultView;
  if (!parent.isConnected || !view) return null;

  const probe = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  probe.setAttribute('width', '1');
  probe.setAttribute('height', '1');
  probe.style.cssText =
    'all: initial !important; position: absolute !important; left: 0 !important; top: 0 !important; ' +
    'width: 1px !important; height: 1px !important; visibility: hidden !important; pointer-events: none !important;';

  try {
    parent.appendChild(probe);
    const matrix = probe.getScreenCTM();
    return matrix ? new view.DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]) : null;
  } finally {
    probe.remove();
  }
}
