# Connector packages

The SQLite and PostgreSQL connectors implement the common
[SQL client contract](sql.md) used by core's `sql:query` and `sql:transaction`. The MQTT connector uses the
[live connector contract](live-connectors.md).

Each `connectors/<name>/` directory with a `package.json` is a pnpm workspace
package, like a package under `packages/`. Declare Ticlo dependencies with the
`workspace:` protocol so the connector uses the same runtime instance as the
application. Keep browser and Node entry points separate when a connector uses
server-only dependencies. Run `pnpm install` after adding a connector to update
the workspace lockfile. Applications import the connector entry point to register
its functions; workspace membership does not load it automatically.

If a function has separate implementations, give each implementation an explicit
package entry point. For example, `@ticlo/oauth/browser` and `@ticlo/oauth/node`
export `registerOAuth()` and both register `auth:oauth`. The host selects one
implementation before loading Flows. Each implementation supplies its own
descriptor. `FunctionModule.addUniqueFactory()` accepts repeat registration of
the same implementation and reports a conflict for another implementation of
the same ID.

Connector sources participate in root TypeScript, formatting, and lint checks.
`pnpm build-package` builds connectors after the currently built core packages,
placing output in `build/<name>/`. `pnpm build-css` compiles a connector's
`style/index.scss` to `style/index.css` when present. YAML translations under
`i18n/` are merged into `i18n/<name>/` by `pnpm build-i18n`.

Name Node tests `*.node.test.ts` and browser tests `*.browser.test.ts` or
`*.browser.test.tsx` so each runs in the matching Vitest suite.
