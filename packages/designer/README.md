# Ticlo Designer

`@ticlo/designer` renders React flows with design and preview modes, component
selection, and hover outlines. `designer.html` is the development host; the app
manages docking, storage, and editor windows.

A flow's React entry point is its direct `#main` value. Components use the
existing `@ticlo/react` renderer registration.

```json
{
  "#main": {"#is": "react:p", "content": "Hello"}
}
```

`DesignerApp` owns global design mode and extends the shared `TicloApp` layout
context. Designer state and behavior stay in this package; editor types remain
generic.

Stage context serves two audiences:

- Components use `ComponentContext` from `@ticlo/react` for design mode,
  element registration, and selection commands. Selection snapshots stay out
  of this context to avoid refreshing components when selection changes.
- Panels use `useActiveDesignerStage()` for the active stage, selected Blocks
  and paths, and editing commands. Each stage keeps its own selection.

In design mode, the stage intercepts component input for designer interactions.
Preview restores normal component input. Components that use portals should
render their popup containers inside the stage.

`useTicloComp` registers the component's root Element with the stage's
`ElementMap` in both modes and merges application refs. Custom components attach
its `optionalHandlers` to their root DOM element.

Load compiled package styles explicitly:

```ts
import '@ticlo/react/style/index.css';
import '@ticlo/editor/style/index.css';
import '@ticlo/designer/style/index.css';
```

Run `pnpm build-css` to generate workspace CSS. Designer SCSS lives beside its
components. React pages work without designer CSS; see the
[React package](../react/README.md) for style imports.
