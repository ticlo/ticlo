---
name: ticlo-project-architecture
description: Navigate Ticlo packages and find task-specific runtime, flow-format, worker, editor, and storage references.
---

# Ticlo architecture

Ticlo combines a reactive dataflow runtime, React visual editor, and browser/Node
integrations. Packages live in `packages/`; demos and dev servers in `app/`;
build and translation tools in `tool/`.

| Package (`@ticlo/…`) | Responsibility |
| --- | --- |
| `core` | Blocks, bindings, functions, scheduling, persistence, client/server sync |
| `editor` | React/Ant Design editor, property panels, function selectors |
| `html` | Browser connections, IndexedDB, static HTTP storage |
| `node` | Filesystem storage, WebSocket/REST connections, secrets, flow test loading |
| `remote-storage` | Writable HTTP storage via `@ticlo/file-client`; host: `@ticlo/file-server` |
| `react` | Flow bindings and components |
| `test` | Flow assertions and test utilities |
| `web-server` | Hono HTTP/WebSocket server using `@hono/node-server` and `@hono/node-ws` |

## References

Read only the references relevant to the task:

- [Core](./core-package.md): execution, bindings, functions, connections, editing helpers.
- [Lifecycle](../../../docs/runtime-lifecycle.md): startup, namespaces, load/unload, persistence.
- [File format](./file-format.md): saved `.ticlo` JSON, property prefixes, binding examples.
- [Workers](./worker-architecture.md): sources, static content, save callbacks, host patterns.
- [Block controls](../../../docs/block-configs.md) and [property editors](../../../docs/editor.md).
- [Remote storage](../../../docs/remote-storage.md): project layout, writes, conflicts, dev server.
- [Static storage](../../../docs/static-storage.md): HTTP indexes and temporary edits.
- [Translations](../ticlo-translation/SKILL.md): locale ownership and generation.
