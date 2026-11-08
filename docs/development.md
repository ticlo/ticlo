# Development

Use the Node.js and pnpm versions in [package.json](../package.json). From the
repository root, run `pnpm install`, then `pnpm dev` for the combined server and
Vite apps. `pnpm server` runs the server alone. Project Git operations require
Git on the server host.

The server runtime stores projects under `app/server/files/serv` and serves
runtime commands at `/ticlo`, files at `/file`, and flow-defined routes at `/api`.
Open `editor.html?host=http://127.0.0.1:8010/` to edit its runtime. Browser projects
use the separate `proj` scope; see [storage routing](remote-storage.md#paths-and-scopes).
For static-only hosting, see [static storage](static-storage.md).

When embedding the HTTP host, create its app before attaching storage so
`^web-server` exists when global data and flows load:

```ts
const root = new Root();
const {app, ticloWs} = await createTicloApp({root, enableEditor: true});
await root.setStorage(storage);
await root.start();
```

`root` defaults to `Root.instance`. See
[code-defined globals](runtime-lifecycle.md#code-defined-globals) for the service
and constant lifetime contract.

## Validation

| Change | Focused check |
| --- | --- |
| Core, Node, file server, remote storage, app helpers | `pnpm test <file-or-directory>` |
| React, designer, editor, HTML, charts | `pnpm test-browser <file-or-directory>` |
| Connector | Its `*.node.test.ts` or `*.browser.test.tsx` tests |
| TypeScript | `pnpm exec tsgo --noEmit` |
| Formatting | `pnpm exec oxfmt --check <changed-files>` |
| Lint | `pnpm oxlint` |

`pnpm test` runs the full Node suite. `pnpm test-browser` runs the browser suite,
including core tests in Chromium. Use the browser suite for DOM behavior and
changes with browser-specific runtime effects. Test routing and exclusions are
maintained in [Node config](../vitest.config.mts) and
[browser config](../vitest.web.config.mts).

For performance changes, compare the same workload before and after the change.
Check work counts or scaling as well as timings; timings alone vary by machine.
Use render counters to check that unrelated Block, panel, or selection changes
do not refresh React components. Preserve tests for data integrity and complex
interaction semantics; avoid fixing incidental layouts with assertions.

## Assets and builds

`pnpm build-css` compiles component SCSS to each package's `style/index.css`.
Vite and browser tests build these styles on startup. Rebuild after SCSS edits.
Apps import the styles they use:

```ts
import '@ticlo/react/style/index.css';
import '@ticlo/editor/style/index.css';
import '@ticlo/designer/style/index.css';
```

React components work with React styles alone. `pnpm build-antd-style` generates
Ant Design styles for both editor themes. See [editor themes](editor.md#themes).

`pnpm build-i18n` regenerates locale JSON from package YAML; follow the
[translation skill](../.agents/skills/ticlo-translation/SKILL.md) when changing translations.
`pnpm build-package` builds publishable workspace packages, including CSS.
`pnpm build-pages` builds browser apps and assets into `dist/`; deployment uses
the [Pages workflow](../.github/workflows/pages.yml).
