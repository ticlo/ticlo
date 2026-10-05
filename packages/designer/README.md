# Ticlo Designer

`designer.html` uses the playground's navigation and tool panels, and renders
React pages in `DesignerStage` tabs. The floating ToolBox opens `editor.html`
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

`DesignerStageContext` exposes that stage's `flow`, `basePath`, `conn`,
`selectedComponents: Block[]`, and `setSelectedComponents`. Each stage keeps its
own selection; replacing or removing its Flow clears it.

Wrap the dock and outside panels with `DesignerProvider` inside `TicloApp`.
`DesignerContext.activeStage` exposes the active stage and its current selection,
following `TicloCurrentFlowContext`. Closing a stage unregisters it. The app
updates focus when another designer tab becomes active, and ToolBox uses this
context to open the active stage's editor.
