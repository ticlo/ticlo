---
name: ticlo-project-architecture
description: Locate Ticlo runtime, React, designer, editor, storage, and tooling code and its task-specific contracts.
---

# Ticlo task map

Runtime and UI packages are in `packages/`; external service integrations are in
`connectors/`; development hosts are in `app/`; build tools are in `tool/`.
Read only the row and reference needed for the task. API signatures and defaults
come from source; validation commands are in [development](../../../docs/development.md).

| Task                                                                                           | Source                                                                     | Reference                                                                                                                               |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Project overview for understanding Ticlo design, reimplementing or porting its dataflow engine | `packages/core`                                                            | [Design](./design.md)                                                                                                                   |
| Blocks, functions, scheduling, bindings                                                        | `packages/core/block`, `core/util`                                         | [Core](../../../docs/core.md)                                                                                                           |
| Saved flow data and function IDs                                                               | `packages/core/block`                                                      | [Flow format](../../../docs/flow-format.md)                                                                                             |
| Startup, libraries, persistence                                                                | `packages/core/block/FlowRuntime.ts`                                       | [Lifecycle](../../../docs/runtime-lifecycle.md)                                                                                         |
| Workers and shared static data                                                                 | `packages/core/worker`                                                     | [Workers](../../../docs/worker-functions.md), [block controls](../../../docs/block-configs.md)                                          |
| Connection protocol and editing commands                                                       | `packages/core/connect`, `core/property-api`, `core/policy`                | [Connection layer](../../../docs/core.md#connection-layer)                                                                              |
| React renderers and subscriptions                                                              | `packages/react`                                                           | [React](../../../docs/react.md), [containers](../../../docs/react-containers.md), [SVG](../../../docs/react-svg.md)                     |
| Designer gestures and selection                                                                | `packages/designer`                                                        | [Designer](../../../docs/designer.md), [geometry](../../../docs/element-geometry.md)                                                    |
| Editor panels and value editors                                                                | `packages/editor`                                                          | [Editor](../../../docs/editor.md), [widgets](../../../docs/block-widgets.md)                                                            |
| File and flow storage                                                                          | `packages/node/storage`, `packages/remote-storage`, `packages/file-server` | [Storage](../../../docs/remote-storage.md), [static indexes](../../../docs/static-storage.md), [HTTP/Git](../../../docs/file-server.md) |
| HTTP/WebSocket runtime hosting                                                                 | `packages/web-server`, `app/server`                                        | [Development](../../../docs/development.md)                                                                                             |
| Charts                                                                                         | `packages/chart`                                                           | [Charts](../../../docs/chart.md)                                                                                                        |
| Service integrations                                                                           | `connectors/`                                                              | [Connectors](../../../docs/connectors.md)                                                                                               |
| Translations                                                                                   | `packages/**/i18n`, `tool/translate`                                       | [Translation skill](../ticlo-translation/SKILL.md)                                                                                      |
