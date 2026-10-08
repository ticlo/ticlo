# Ticlo React

Load React component styles through the package's CSS entry point:

```ts
import '@ticlo/react/style/index.css';
```

Workspace apps use the same CSS import after `pnpm build-css`. Vite and browser
tests build package CSS on startup. Package builds compile CSS for publishing
with the same build helper, so consumers do not need Sass.

React component styles are independent of editor and designer styles.

`Horizontal`, `Vertical`, and `Absolute` accept a Ticlo `block` prop and are also
registered as `react:horizontal`, `react:vertical`, and `react:absolute`. They
render divs with the usual element properties and children, adding
`ticl-horizontal`, `ticl-vertical`, or `ticl-absolute` alongside any custom class.

Horizontal and Vertical use row and column flex layouts. Absolute provides a
relative positioning container whose direct children are absolute by default;
child styles can override their position.
