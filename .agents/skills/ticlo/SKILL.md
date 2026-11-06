---
name: ticlo-project-architecture
description: Navigate Ticlo packages and find task-specific runtime, flow-format, worker, editor, and storage references.
---

# Ticlo architecture

Ticlo combines a reactive dataflow runtime, React visual editor, and browser/Node
integrations. Runtime and UI packages live in `packages/`; external service
packages live in `connectors/`. Demos and dev servers live in `app/`; build and
translation tools live in `tool/`.

| Package (`@ticlo/…`) | Responsibility                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `core`               | Blocks, bindings, functions, scheduling, persistence, client/server sync                  |
| `editor`             | React/Ant Design editor, property panels, function selectors                              |
| `designer`           | React page stages, design input, and selection; reuses editor tools                       |
| `html`               | Browser connections and DOM integrations                                                  |
| `node`               | Direct filesystem project storage, WebSocket/REST connections, secrets, flow test loading |
| `file-server`        | Hono project and user file routes, including Git operations                               |
| `remote-storage`     | Browser file/flow storage and HTTP client: Remote, read-only Static, and local IndexedDB  |
| `react`              | Flow bindings and components                                                              |
| `test`               | Flow assertions and test utilities                                                        |
| `web-server`         | Hono HTTP/WebSocket server using `@hono/node-server` and `@hono/node-ws`                  |

## Documentation

Keep every `README.md` in this project limited to a general introduction to the
project or package it describes. Put technical details in separate documentation.

## References

Read only the references relevant to the task:

- [Core](./core-package.md): execution, bindings, functions, connections, editing helpers.
- [Lifecycle](../../../docs/runtime-lifecycle.md): startup, namespaces, load/unload, persistence.
- [File format](./file-format.md): saved `.ticlo` JSON, property prefixes, binding examples.
- [Workers](./worker-architecture.md): sources, static content, save callbacks, host patterns.
- [Block controls](../../../docs/block-configs.md) and [property editors](../../../docs/editor.md).
- [Remote storage](../../../docs/remote-storage.md): project layout, writes, conflicts, dev server.
- [Static storage](../../../docs/static-storage.md): HTTP indexes, read-only files, and the writable local project.
- [Connectors](../../../docs/connectors.md): workspace, build, and test conventions for service packages.
- [Translations](../ticlo-translation/SKILL.md): locale ownership and generation.
