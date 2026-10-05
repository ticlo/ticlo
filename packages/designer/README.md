# Ticlo Designer

`designer.html` uses the playground's navigation and tool panels, and renders
React pages in `DesignerStage` tabs. The right column contains ToolBox above
the active stage's component tree. ToolBox opens `editor.html`
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

`DesignerStageContext` exposes that stage's `flow`, `main`, `basePath`, `conn`,
and `selection: {blocks: Block[], paths: string[]}`. `select()` accepts Blocks
or full paths and updates both arrays together. Each stage keeps its own
selection. Removing selected nodes drops them; replacing the page root clears it.

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
tab becomes active, and ToolBox opens the active stage's editor.

`DesignerNodeTree` reuses the editor's controlled `NodeTree` with the page's
main Block as its only root. It reads `selection.paths` and calls `select()`;
changes through the stage context update the same tree selection. The app also
forwards these paths to the existing navigation and property panels.
