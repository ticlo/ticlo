# Designer stage interactions

Designer stages operate on local Blocks directly. Outline selection may span
parents; stage additions and group movement keep selections under one Block
parent. Component selection snapshots stay out of the React component context.

Each designer stage owns one element map for its editable flow. `TicloPage` from
`@ticlo/react` renders a flow's `#main` or a component's `#return` without adding
a DOM wrapper. Worker root elements register as their outer host Block,
including through nested workers;
internal Blocks remain unregistered and use design mode disabled with inactive
selection commands. Blocks belonging to the stage's flow retain its component
context and register as themselves even when rendered inside a worker. When a
delegated root is itself an editable Block, the host owns the shared root DOM.

Each stage exposes separate `functionTreeTags` and `nodeTreeTags` lists. Both
default to `['react-comp']` on `DesignerStage` and can be configured independently
through its props. The function panel uses the active stage's function tags;
`DesignerNodeTree` uses its node tags and shares its selection. A descriptor matches
when it has any listed tag. Unmatched node branches are hidden, and function
categories remain visible when they contain matching functions. Dataflow stages
leave these lists undefined to show all functions and nodes.

When stage selection changes, `DesignerNodeTree` expands the selected paths'
ancestors, loading each level as needed. Switching stages also reveals their
restored selections. Manual expansion and collapse remain available.

In design mode, page input is forwarded to the stage as events of the same type,
with pointer coordinates, keyboard modifiers, and drag/touch data preserved.
Stage and ancestor listeners receive these events, while page components' native
and React input handlers do not run. Forwarded events target the stage and
are synthetic (`isTrusted: false`). Native wheel scrolling remains enabled unless
a stage or ancestor listener prevents its default. Preview restores page input.

Function drags use the same connection-scoped payload as the node tree. Child
insertion resolves the frontmost hit component, then its nearest ancestor whose
descriptor accepts the function's tags. Release creates a uniquely named Block
in that container's `#order`, refreshes the outline tree, and selects the new
component. The connection's edit policy is checked during hover and again at
release.

Absolute layouts convert the pointer to local child coordinates and preserve the
new child's initial style dimensions, centering the child and its drop indicator
on the pointer. The drop indicator uses numeric dimensions
from that style, falling back to 100 CSS pixels for each unspecified dimension;
the fallback is not saved on the child. The three layout functions initialize
their styles with a width and height of 200 CSS pixels. Horizontal and vertical
layouts infer an order index from the nearest rendered child; an empty layout
appends its first child.
An unordered `content` component stays before new ordered children. Insertion
feedback follows container transforms and is an estimate of the new child's
placement.

`DesignerStage` accepts optional `onDragOverT` and `onDropT` callbacks receiving
the rc-dock `DragState` and the directly hit component (`DesignerDropTarget`, or
null). These callbacks run before child insertion and receive leaf components
as well as containers. Returning true from `onDragOverT` accepts the drag;
returning true from `onDropT` handles the drop. Returning false lets the default
child insertion run. This allows other drag payloads, such as data bindings, to
use the same stage without requiring a child container.

`addSelection` retains siblings of the last valid added component. Adding an
already selected component still prunes other parents, and returns false unless
a new component was selected.

React component descriptors expose two boolean Block attributes, both false by
default, using `attributes: ['@d-lock', '@d-seal']`. Named attributes resolve
through the core attribute descriptor registry; custom descriptors can also be
included in the same array. `@d-lock` prevents selecting the component in the
stage while leaving its children selectable. `@d-seal: true` or an empty/missing
`#order` prevents selecting descendants; a hit within the subtree resolves to
the outermost such component. A locked container with selectable children can
still start child marquee selection. A locked component without selectable
children excludes its entire subtree from stage selection. These rules do not
restrict the outline tree.

Unselected containers supporting `react-comp` children with a nonempty `#order`
and no seal defer selection until release. Moving at least four viewport CSS
pixels instead starts a marquee; any partial intersection selects a direct child,
except locked children. Ctrl
adds siblings to the selection. Components without selectable children select
immediately.
Mouse down prioritizes selected components under the pointer, even behind an
unselected component. Overlapping selected
components use the browser's front-to-back paint order, subject to the lock and
child-selection rules.
Pressing a selected component with Ctrl removes it; without Ctrl it retains
selected siblings and can start movement. Unselected containers with selectable
children use the marquee gesture even if their own position is absolute.
For a selected container with selectable children, releasing a click on a child
without Ctrl replaces the selection with that direct child, entering only one
level even when the pointer is over a deeper descendant. A locked direct child
keeps the container selected. Dragging moves the selected container when it is
movable; otherwise it starts child marquee selection, from either a child or
empty space. Crossing the four-pixel threshold starts a drag even if the pointer
later returns to its starting point. Escape cancels a pending child click too.

Movement requires computed `position: absolute` and a directly writable style:
a set object, a set null/undefined value, or the component's own
`html:create-style` binding helper. Other style bindings are not moved. The
pressed element's position matrix converts viewport movement to CSS inset
changes; every eligible selected component receives that same delta. Ancestor
transforms and the pressed element's own CSS zoom are included. Its own transform
is excluded from the movement basis, while its grabbed point supplies the depth
used for perspective movement.

Geometry comes from the HTML package's batch element geometry API. Selection and
hover outlines follow border-box corners, and marquee selection tests the actual
quad for partial intersection. Shared ancestors are measured once per batch,
and ancestor style/layout changes schedule a new measurement. Unsupported
geometry retains rectangular selection feedback; movement requires an available,
invertible position mapping.

Dragging caches viewport geometry for the gesture, including transforms above
the stage. The grabbed point stays under the pointer through perspective as well
as 2D transforms; eligible siblings receive the same CSS inset delta. Selection
outlines use stage-relative geometry and exclude transforms above the stage.

Movement changes left/top unless only right/bottom is defined on that axis.
Existing CSS lengths are resolved to pixel numbers at gesture start. Committing
a helper coordinate replaces that coordinate's binding, while retaining the
component's binding to its style helper. Newly used helper fields are included
in `#optional`.

Resize gestures operate in the component's local box coordinates. Ancestor and
component transforms map pointer movement to dimensions; absolute components
also adjust their existing insets to retain the opposite corner or edge. When
both left/right or top/bottom are defined, resizing that axis changes its insets
without writing width or height. Other axes change their dimensions, and in-flow
components change dimensions only. Resolved CSS lengths are saved as pixels.

The resize outline and pointer mapping retain the geometry captured at gesture
start. Layout reflow, wrapping, and scrolling can move the rendered component
without moving the dragged outline or changing the pointer's sizing basis.
After release or cancellation, the outline follows the rendered component again.
Resize edits use the same writable styles, helpers, and history rules as movement.

Dragging changes runtime values only. Release saves the final values and calls
the flow's existing debounced history tracking, which can merge edits within one
second. Null/undefined styles preview as objects and create a style helper only
on commit. Escape, pointer cancellation, window blur, preview mode, or unmount
restores saved values and current binding-source values without recording a
change. Temporary optional fields are restored too.
