# Ticlo Designer

`designer.html` uses the playground's navigation and tool panels, and renders
React pages in `DesignerStage` tabs. The left column contains a compact
ToolBox for language settings above Navigation and Functions. The right column
contains Properties above Outline, the active stage's component tree.
The floating Open Editor button at the top right opens `editor.html`
through a `FrameServerConnection`, so the editor changes the same live runtime.

The current stage is a page viewer. Canvas selection and WYSIWYG editing will
be added later. Dock layout and editor-window management belong to the app.

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
  (`true` for design, `false` for preview), `select()` and `addSelection()`. Both commands accept
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
Both arrays update together, and each stage keeps its own selection and mode.
Removing selected nodes drops them; replacing the page root clears selection.

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
