---
name: ticlo-project-architecture
description: High-level overview of the Ticlo monorepo, its packages, and architecture. Helps understand how the different components of Ticlo integrate together.
---

# Ticlo Architecture Overview

This document provides a high-level overview of the Ticlo project. Ticlo is a monorepo that encapsulates a dataflow-based execution engine, a visual Node/Block-based editor, and various integration layers for the web and Node.js environments.

## Packages Structure

The project code is divided into several packages under the `packages/` directory:

| Package                  | Responsibility                                                                                                                                                                                                                                                                                |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@ticlo/core`**        | **The most important package.** The foundational engine of the Ticlo ecosystem. It provides the Flow parser, AST representations (`Block`, `Flow`), built-in execution functions, serialization, and synchronization connections. For a deep dive, read [core-package.md](./core-package.md). |
| **`@ticlo/editor`**      | The frontend visual editor application, built with React and Ant Design (`antd`). It includes components for a canvas (Dataflow Editor), property panels, function selectors, scheduler UI, and code editors. Relies on `@ticlo/core`.                                                        |
| **`@ticlo/html`**        | Web-specific utilities and bindings, bridging `@ticlo/core` behavior to browser-specific capabilities. Uses `idb` for browser-based IndexedDB local storage.                                                                                                                                  |
| **`@ticlo/node`**        | Node.js integration for Ticlo. Contains backend bridges (like WebSockets) to securely run or sync `@ticlo/core` flows outside the browser environments.                                                                                                                                       |
| **`@ticlo/react`**       | Generic React bindings and components designed for consuming and interacting with Ticlo flows in custom React frontends.                                                                                                                                                                      |
| **`@ticlo/react-class`** | Additional React integrations, possibly using class components or alternative object-oriented React bindings.                                                                                                                                                                                 |
| **`@ticlo/test`**        | Test utilities for validating Ticlo flows and data properties. Uses tools like `chalk`, `pretty-format`, and `diff-sequences`.                                                                                                                                                                |
| **`@ticlo/web-server`**  | A server implementation designed to host/run Ticlo files using `fastify` and WebSocket implementations (`@fastify/websocket`). Relies on `@ticlo/core` and `@ticlo/node`.                                                                                                                     |

## The Ticlo Core Execution Engine

Ticlo flows run on `@ticlo/core`. This engine is designed around reactive, node-based programming. Instead of direct code strings, logic is parsed from `.ticlo` files (a highly specific JSON schema).

The engine uses `Connection` classes (`ServerConnection.ts`, `ClientConnection.ts`) to permit external programs (like the visual `editor`) to monitor or dispatch changes across the flow over a network or locally.

For a deep dive into how `@ticlo/core` is structured, please read the [Core Package Details](./core-package.md).

## File Format & Serialization

Ticlo flows are structured as a tree of **Blocks** represented in JSON (`.ticlo` files).
Understanding the `.ticlo` format is critical for creating or modifying flow files without the visual editor.

For details on the `.ticlo` file format, syntax, configuration prefixes (`#`, `~`, `^`, `@`), and valid examples, please read the [Ticlo File Format Documentation](./file-format.md).
