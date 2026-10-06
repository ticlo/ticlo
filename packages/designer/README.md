# Ticlo Designer

`designer.html` uses the playground's navigation and tool panels, and renders
React pages in `DesignerStage` tabs. The left column contains a compact
ToolBox for language settings above Navigation and Functions. The right column
contains Properties above Outline, the active stage's component tree.
The floating Open Editor button inside ToolBox's upper-right corner opens `editor.html`
through a `FrameServerConnection`, so the editor changes the same live runtime.

The canvas supports selection and hover outlines. WYSIWYG editing will be
added later. Dock layout and editor-window management belong to the app.

Styles live in `style/index.scss` and compile to `css/designer.css` for the apps.
Load this alongside `css/react.css` for the page's component styles. The app also
loads editor, Ant Design, and icon styles for its tool panels. Designer styles
only target designer classes; ordinary React pages do not need them.

Only `#main` directly under the opened Flow is its React entry point. Nested
`#main` properties are not searched, and an ordinary Block is not a page Flow.
The flow's `#main` can be an owned component block, a binding to a component
block, or a runtime React element. A flow without
`#main` shows an empty state. Ordinary `#output` values are not page roots.

```json
{
  "#main": {
    "#is": "react:div",
    "#order": ["title"],
    "title": {"#is": "react:p", "content": "Hello"}
  }
}
```

The local app shares playground's IndexedDB storage and starts with a separate
`designer-example` flow. Use `designer.html#flow=my-flow` to open another flow,
or double-click it in Navigation. File-server storage accepts the same `host`,
`project`, and `flow` hash parameters as playground.

Components use the existing `@ticlo/react` renderer registration. Future
`@ticlo/ui` components can use the same registration without a separate
designer renderer.

Stage context has two audiences:

- Components import `ComponentContext` from `@ticlo/react`. It exposes `designMode`
  (`true` for design, `false` for preview), the stage's stable `elementMap`, `select()` and `addSelection()`. Both commands accept
  Blocks or full paths. Outside a designer, `designMode` defaults to `false` and
  selection commands do nothing.
- Panels use `useActiveDesignerStage()` from `@ticlo/designer`. Its value adds
  `flow`, `main`, `basePath`, `conn`, `selection: {blocks, paths}`, `setDesignMode()`,
  `undo()` and `redo()`. It also exposes the same selection commands.

The component context keeps its identity while selection or active-panel state
changes. `DesignerPage` is memoized to isolate ordinary parent renders as well.
Mode changes update component context consumers. Panels receive live selection
snapshots through the existing stage registry; there is no second local panel
provider wrapping the page.

`select()` replaces selection; `addSelection()` appends and deduplicates it.
Both return `true` when they select a new block, or `false` when every block was
already selected (or no valid blocks were supplied).
Both arrays update together, and each stage keeps its own selection and mode.
Removing selected nodes drops them; replacing the page root clears selection.

`useSelection(block, componentContext)` from `@ticlo/react` provides a mousedown handler only in
design mode. It selects the block, or adds it when Ctrl is pressed, and stops
bubbling so parent components do not select themselves. `useTicloComp` installs
this handler and skips all of the component's optional handlers whose names
start with `on` in design mode. Attributes and `ref` callbacks remain active.
It reads `ComponentContext` once and passes its value
to the selection hook, and `designMode` to the optional handlers hook. Preview
mode uses the original handlers.

Each stage owns an `ElementMap` with Block-to-Element and Element-to-Block
registrations. Multiple rendered instances of a Block are supported, and refs
remove their registrations on unmount. The map remains available in preview.
`useTicloComp` always supplies a root ref in `optionalHandlers`, merging it with
the optional `ref` handler and a component's own `useTicloComp(block, {ref})`.
Callback refs (including cleanup functions) and object refs are supported.
Automatic registration does not write DOM nodes into Block properties; the
existing optional `ref` output remains opt-in. Custom components attach these
handlers to their actual root DOM Element.

`DesignerSelectionLayer` is a sibling of `DesignerPage` managed by the stage.
It draws selected instances and a lighter outline around the hovered component
only in design mode. Outlines pass pointer events through to the page. Selection
is retained when an Element is temporarily hidden or absent.
Measurement is scheduled on target or ref changes, scroll, and stage/target
resize, with updates coalesced into one animation frame. Mouse movement within
the same component does not measure again. Position-only changes and animations
may leave outlines temporarily stale until the next measurement trigger.
There are no drag targets or resize handles yet.

Designer and dataflow stages share `TicloApp`'s stage registry.
The editor's public context uses `TicloStage<TicloSelection>` by default:
`selection` contains only `paths`, and `select()` accepts paths. Its generic
selection type is extended by `TicloStage<DesignerSelection>` in the designer
package, adding `blocks` without introducing the runtime Block type into the
editor context. `TicloCurrentFlow` and `TicloLayoutContext` also accept a stage
type parameter; these types all describe the same shared provider.
`TicloCurrentFlowContext.activeStage` follows the active flow, and
`useActiveDesignerStage()` returns its designer state to outside panels.
There is no separate Designer provider or active-stage registry.
Closing a stage unregisters it. The app updates focus when another designer
tab becomes active, and Open Editor opens the active stage's editor.

`DesignerNodeTree` reuses the editor's controlled `NodeTree` with the page's
main Block as its only root. It reads `selection.paths` and calls `select()`;
changes through the stage context update the same tree selection. Properties
reads the active designer stage's selected paths directly. Navigation maintains
its own selection.
