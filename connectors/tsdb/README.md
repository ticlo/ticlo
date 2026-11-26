# @ticlo/tsdb

Node.js embedded time-series database (`ticlo-tsdb`) history connector for Ticlo.

- Registers `tsdb:client` (`category: 'database'`, tagged `history-client`, `context-service`).
- Uses Ticlo's `resolveFilePath` for project-relative (`+/...`), cross-project, or `:memory:` storage paths just like `@ticlo/sqlite`.
- Works with the core `history` block function (standalone or as a `#-history` block addon).
