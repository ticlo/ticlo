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
the same component-facing contract.

`ComponentContext` contains design mode, the element map, and stable selection
commands. Selection snapshots and gesture previews belong to designer panels;
they must not propagate through this context. Worker render boundaries register
the outer host's root while keeping internal components outside design mode.
See [designer ownership](designer.md#rendering-and-context).

[Containers](react-containers.md) defines child ordering and View Deck lifecycle;
[SVG](react-svg.md) defines SVG element contracts. Style imports and builds are in
[development](development.md#assets-and-builds). React styles are independent of
designer styles.
