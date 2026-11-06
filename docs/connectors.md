# Connector packages

Each `connectors/<name>/` directory with a `package.json` is a pnpm workspace
package, like a package under `packages/`. Declare Ticlo dependencies with the
`workspace:` protocol so the connector uses the same runtime instance as the
application. Keep browser and Node entry points separate when a connector uses
server-only dependencies. Run `pnpm install` after adding a connector to update
the workspace lockfile. Applications import the connector entry point to register
its functions; workspace membership does not load it automatically.

Connector sources participate in root TypeScript, formatting, and lint checks.
`pnpm build-package` builds connectors after the currently built core packages,
placing output in `build/<name>/`. `pnpm build-css` compiles a connector's
`style/index.scss` to `style/index.css` when present. YAML translations under
`i18n/` are merged into `i18n/<name>/` by `pnpm build-i18n`.

Name Node tests `*.node.test.ts` and browser tests `*.browser.test.ts` or
`*.browser.test.tsx` so each runs in the matching Vitest suite.
