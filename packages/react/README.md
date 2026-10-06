# Ticlo React

React component styles live in `style/index.scss`. The app build emits
`css/react.css`, and the package build includes `style/index.css`:

```ts
import '@ticlo/react/style/index.css';
```

Workspace apps can import `@ticlo/react/style/index.scss` with a Sass-capable
bundler, or load the generated `css/react.css` directly.

These styles include Markdown formatting and do not depend on editor,
designer, rc-dock, or Ant Design styles. Components continue to apply their
Block's `style` inline. Load designer styles separately when using a designer stage.
