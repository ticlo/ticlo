# React rendering

`@ticlo/react` binds local Blocks to React components. Flows render their direct
`#main`; component functions return a Block or React element through `#return`.
`TicloPage` implements this entry contract without a DOM wrapper. `TicloComp`
selects a renderer from function metadata under the `react` key and otherwise
uses `TicloPage`. Registrations may be global, flow-local, or Library-scoped.

## Subscriptions

- `useBlockValue(block, name)` reads one property, including configs and function values.
- `useValue(block, path)` follows a relative binding path.
- `useBlockConfigs(block, propMap)` converts mapped values and honors each entry's
  optional source `name`. `useBlockProps` is the same API.
- `useFilteredBlocks` observes a Block's child list.
- `FlowRoot` supplies a Flow through `useFlow`; unnamed generated flows are owned
  by the React mount, while supplied or named flows remain externally owned.

Keep property maps and converter functions stable. Mapped subscriptions compare
raw values before conversion and retain their snapshot when converted fields are
unchanged. Components and pages memoize unchanged props; renderer metadata
subscriptions refresh only when the selected renderer changes.

## Components and designer integration

`useTicloComp` supplies styles, classes, resolved children, and `optionalHandlers`.
Attach those handlers to the component's root Element to retain optional events,
application refs, and ElementMap registration. Both preview and design mode use
the same component-facing contract. Local event bindings can use the React event
through `data`. The inspector and serialized values expose the event type and
scalar fields such as `data.clientX`, `data.ctrlKey`, and `data.key`.

`ComponentContext` contains design mode, the element map, and stable selection
commands. Selection snapshots and gesture previews belong to designer panels;
they must not propagate through this context. Worker render boundaries register
the outer host's root while keeping internal components outside design mode.
See [designer ownership](designer.md#rendering-and-context).

## PageInclude and page lifecycle

- `react:page-include` renders a project `.ticlo` Flow (resolved via `src`) as a
  shared live Flow instance rather than an isolated worker, bridging `#inputs` and
  `#outputs` between the host block and target Flow.
- `#closeMode` (`'on' | 'off' | 'disable'`, default `'off'`) controls what the last
  closing holder does to a clean included Flow; concurrent includes are capped by the
  target Flow's `#inputs.#maxInstance` (default `8`).
- `enterPageFlow` and `leavePageFlow` coordinate browser mounts on ordinary
  storage-backed Flows (`flow:main`); Node.js runtime does not participate.

[Containers](react-containers.md) defines child ordering and View Deck lifecycle;
[SVG](react-svg.md) defines SVG element contracts. Style imports and builds are in
[development](development.md#assets-and-builds). React styles are independent of
designer styles.
