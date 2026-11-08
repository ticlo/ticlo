# Designer

`DesignerApp` extends `TicloApp` with shared design mode. Designer behavior stays
in this package; editor stage and selection types remain generic.

## Rendering and context

A stage renders the Flow's direct `#main` through `TicloPage`. Its ElementMap
connects rendered elements to editable Blocks. A worker root belongs to its outer
host Block, including nested workers; internal Blocks remain unregistered with
design mode disabled. Blocks in the stage's Flow retain their own ownership,
even when rendered inside a worker. A delegated editable root belongs to its host.

Components receive design mode and stable selection commands through
`ComponentContext`; panels use `useActiveDesignerStage()` for selection snapshots
and commands. Selection, hover, drag previews, and background panel updates should
not refresh the page's components. Each stage retains its own selection.

Ordinary Flow pages fill the stage. Worker instances and editors retain their
root component's own sizing. Custom components attach `useTicloComp`'s
`optionalHandlers` to their root Element. Portals used by page components should
remain inside the stage.

`functionTreeTags` and `nodeTreeTags` independently filter descriptors by any
matching tag. Both default to `react-comp`, `react-svg`, and `chart-series`.
Unmatched node branches are hidden. Dataflow stages leave filters undefined.

## Selection and commands

Outline selection may span parents. Stage additions and group movement retain
siblings under one parent. `addSelection` uses the last valid added component's
parent and reports whether any new component was selected. Selecting a hidden
View Deck descendant reveals its page without saving a selection edit; see
[containers](react-containers.md).

`@d-lock` prevents stage selection of a component while allowing selectable
children. `@d-seal`, or an empty/missing `#order`, prevents selecting descendants.
Drops skip sealed subtrees and seek a compatible ancestor. These restrictions
do not hide components from the outline tree.

Mouse release activates the stage. Keyboard commands target only the active
stage and honor its connection policy; shared dispatch is defined in
[editor commands](editor.md#current-stage-and-commands). Preview restores page
input and disables structural editing. In design mode the stage intercepts page
input and forwards events to stage and ancestor listeners, preserving pointer,
keyboard, drag, and touch data. Forwarded events are untrusted. Native wheel
scrolling remains available unless a stage or ancestor prevents it.

Copy requires siblings. Paste inserts into the selected parent, or `#main` when
there is no child selection. It renames collisions, updates `#order`, and selects
the inserted Blocks. `onSave` may supply the host's save action; otherwise the
stage calls `conn.applyFlowChange(basePath)`.

## Drops and geometry

Function drops use connection-scoped payloads and choose a compatible ancestor
of the frontmost hit component. Insertion uses the container's layout, updates
`#order`, and rechecks policy on release. Optional `onDragOverT` and `onDropT`
callbacks receive the DragState and directly hit component; returning true
handles the operation, while false permits normal insertion.

Selection and marquee use actual element quads. Move/resize gestures cache their
coordinate basis for the gesture, including ancestor transforms and CSS zoom.
Selection outlines use stage-local coordinates. The HTML package owns the
[geometry contract](element-geometry.md), including unsupported cases.
SVG position editing is described in [React SVG](react-svg.md).

Movement requires absolute positioning and a writable style object, unset style,
or the component's own `html:create-style` helper. Other style bindings are
preserved. Eligible siblings receive the same local delta. Resizing adjusts
dimensions and, for positioned elements, the insets needed to retain the opposite
edge. When both insets define an axis, those insets are adjusted instead of size.

Gestures preview runtime values. Release commits final values through existing
history tracking. Helper edits retain the owning style binding and enable newly
used fields. Escape, cancellation, blur, preview mode, or unmount restores saved
values and current binding sources without an edit. No-op gestures must not
create a history entry.
