# Element geometry

`getElementBoxQuads(elements, root)` is exported by `@ticlo/html`. It returns a
`Map<Element, DOMQuad | null>` with one entry per unique input element. Each quad
describes the element's border-box corners: top-left, top-right, bottom-right,
and bottom-left in local box order, even after rotation or reflection.

```ts
import {getElementBoxQuads} from '@ticlo/html';

const quads = getElementBoxQuads(selectedElements, stageElement);
const quad = quads.get(selectedElements[0]);
```

Coordinates are CSS pixels in `root`'s local border-box space, with its top-left
border corner at `(0, 0)`. Root scrolling and its perspective on children are
included. Root's own transform and zoom, and transforms above root, are excluded.
The root must contain the inputs and their positioning containing blocks.

Measurement supports HTML boxes with nested 2D/3D transforms, individual
translate/rotate/scale properties, transform origins, perspective,
`preserve-3d`/flattening boundaries, CSS zoom, and scrolling. It uses native
layout offsets for in-flow boxes, including flex and grid layouts; those offsets
can introduce subpixel rounding. Absolutely positioned boxes use resolved CSS
insets and retain their fractional positions.

Inputs must have a single layout box. `null` indicates unavailable or unsupported
geometry: disconnected elements, boxes without layout, inline or
`display: contents` boxes, SVG, shadow boundaries, motion paths, transforms using
content-box/fill-box reference boxes, positioning outside root, or corners on or
behind the perspective plane. A `preserve-3d` paint-containment boundary also
returns `null` for descendants when browser differences in flattening could
affect their projected corners. Quads describe the full box; overflow clipping,
clip paths, rounded corners, and occlusion do not trim them.

The API performs no DOM writes or probe insertion. Within one call, shared
ancestors, layout data, containing blocks, and child-coordinate matrices are
reused across all targets, including targets in different branches. There is no
cache between calls; callers control measurement timing and any longer-lived
caching. Pending style or layout changes can still cause a synchronous browser
layout update when measurements are read.

`getElementGeometry(elements, root?)` returns the same batch as
`Map<Element, ElementGeometry | null>`, including each quad, its border-box
`matrix`, its `positionMatrix` before the element's own transform, and that own
`transform` (or `null` for identity). CSS zoom is included in the position matrix.
These matrices retain homogeneous coordinates; projecting a point requires
dividing its transformed x/y by w. Inverting the projected local z=0 plane is
different from inverting a full 3D matrix.

Omitting `root` measures in viewport client coordinates. This includes transforms
above the designer stage and document scrolling, for mapping pointer gestures.
It aligns the document element against its bounding rectangle once per batch;
no probes are inserted. Stage-relative selection measurements continue to stop
at their supplied stage.
