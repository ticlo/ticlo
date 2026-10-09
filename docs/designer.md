# Designer stage interactions

Designer stages operate on local Blocks directly. Outline selection may span
parents; stage additions and group movement keep selections under one Block
parent. Component selection snapshots stay out of the React component context.

In design mode, page input is forwarded to the stage as events of the same type,
with pointer coordinates, keyboard modifiers, and drag/touch data preserved.
Stage and ancestor listeners receive these events, while page components' native
and React input handlers do not run. Forwarded events target the stage and
are synthetic (`isTrusted: false`). Native wheel scrolling remains enabled unless
a stage or ancestor listener prevents its default. Preview restores page input.

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
pressed element's parent matrix converts viewport movement to CSS coordinates;
every eligible selected component receives that same delta. Ancestor zoom and
scale are included, the pressed element's own CSS zoom is accounted for, and its
own transform does not affect the coordinate delta.

Movement changes left/top unless only right/bottom is defined on that axis.
Existing CSS lengths are resolved to pixel numbers at gesture start. Committing
a helper coordinate replaces that coordinate's binding, while retaining the
component's binding to its style helper. Newly used helper fields are included
in `#optional`.

Dragging changes runtime values only. Release saves the final values and calls
the flow's existing debounced history tracking, which can merge edits within one
second. Null/undefined styles preview as objects and create a style helper only
on commit. Escape, pointer cancellation, window blur, preview mode, or unmount
restores saved values and current binding-source values without recording a
change. Temporary optional fields are restored too.
