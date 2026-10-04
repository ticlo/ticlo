# Ticlo Designer

`designer.html` uses the playground's navigation and tool panels, and renders
React pages in `DesignerStage` tabs. The floating ToolBox opens `editor.html`
through a `FrameServerConnection`, so the editor changes the same live runtime.

The current stage is a page viewer. Canvas selection and WYSIWYG editing will
be added later. Dock layout and editor-window management belong to the app.

Each flow's `#main` is its React entry point. It can be an owned component block,
a binding to a component block, or a runtime React element. A flow without
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
