---
name: ticlo-project-architecture
description: High-level overview of the Ticlo monorepo, its packages, and architecture. Helps understand how the different components of Ticlo integrate together.
---

# Ticlo Architecture Overview

Ticlo combines a reactive dataflow engine, a React visual editor, and browser
and Node.js integrations. Code lives under `packages/`; `app/` contains demo
pages and development servers, and `tool/` contains build and translation tools.

## Packages

| Directory | Package | Responsibility |
| --- | --- | --- |
| `core` | `@ticlo/core` | Block/flow runtime, bindings, scheduling, built-in functions, serialization, and client/server synchronization. |
| `editor` | `@ticlo/editor` | React and Ant Design visual editor, property panels, function selectors, scheduler UI, and code editors. |
| `html` | `@ticlo/html` | Browser connections, IndexedDB storage, and HTTP static storage with temporary in-memory edits. |
| `node` | `@ticlo/node` | Filesystem storage, WebSocket/REST connections, secrets, and flow test loading. |
| `remote-storage` | `@ticlo/remote-storage` | Writable HTTP storage using `@ticlo/file-client`. The external host package is named `@ticlo/file-server`. |
| `react` | `@ticlo/react` | React bindings and components for consuming Ticlo flows. |
| `test` | `@ticlo/test` | Flow assertions and test utilities. |
| `web-server` | `@ticlo/web-server` | Hono HTTP server and WebSocket integration using `@hono/node-server` and `@hono/node-ws`. |

`.ticlo` files serialize block trees as JSON. `Root` loads flows through a
`FlowStorage`; `Storage` provides generic string values. `ServerConnection`
and `ClientConnection` synchronize runtime state and editor commands through
local, window-message, or network transports.

## References

Read the relevant reference for the area being changed:

- [Core package](./core-package.md): runtime lifecycle, bindings, persistence, and connections.
- [File format](./file-format.md): saved block data, configuration, bindings, and examples.
- [Worker architecture](./worker-architecture.md): inline and named workers, static content, and saving worker edits.
- [Static storage](../../../docs/static-storage.md): `proj/<project>` layout, `.list.json` indexes, and the static demo.
- [Remote storage](../../../docs/remote-storage.md): the same project layout with writable APIs, ETags, and development setup.

Static and remote storage map projects to namespaces, use `_root` for
unqualified flows and global data, and load dependencies from `deps/`.
Their layout differs from Node's existing `FileFlowStorage`; do not assume
these adapters use identical on-disk namespace/library paths.
