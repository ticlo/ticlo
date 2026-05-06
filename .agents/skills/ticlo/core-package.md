# Ticlo Core Package Architecture

The `@ticlo/core` package is the foundational engine of the Ticlo ecosystem. It is responsible for parsing, executing, and serializing Ticlo flows, as well as providing built-in functions.

## Directory Structure

- `block/`: The core execution primitives. Contains `Block.ts`, `Flow.ts`, `BlockProperty.ts`, `BlockFunction.ts`, etc. These classes define the AST representation and execution lifecycle of Ticlo flows.
- `connect/`: Defines the communication protocol between the flow engine and external consumers, such as the visual editor or client applications (`ServerConnection.ts`, `ClientConnection.ts`).
- `functions/`: The built-in nodes/functions that end-users can insert into their flows. Grouped into categories like `math`, `string`, `data`, `web-server`, `http`, `condition`, `time`, etc.
- `worker/`: Components handling specialized function execution, like `MapFunction.ts`, `WorkerFunction.ts`, `HandlerFunction.ts`. Used for parallel/asynchronous step execution and abstractions.
- `property-api/`: Exposes APIs for manipulating block properties dynamically at runtime.
- `util/`: Shared utilities that other packages depend on. Includes data types definition (`DataMap`, `TRUNCATED`), specialized serialization (`encode`, `decode`, arrow functions logic), path resolution logic (`resolvePath`), date-time utilities, and loggers.

## Key Concepts

### Block

The `Block` is the fundamental unit of computation in a Ticlo flow. Every step or node in a flow is a block. A `Flow` is a specialized form of `Block` that contains other child blocks. Blocks evaluate `#is` to determine what function they represent.

### Functions

A function in `@ticlo/core` defines the behavior of a block.

- `BaseFunction`, `StatefulFunction`, `PureFunction` are base classes.
- Functions are exported via `index.ts` and registered using `Group`.

### Connection

`ServerConnection` and `ClientConnection` (and `LocalConnection`) form the RPC/Sync layer. They allow editors to read the current state of a flow, subscribe to changes, and dispatch edits.

## Integration

All other packages in the workspace (like `@ticlo/editor` for UI, `@ticlo/web-server` for hosting, `@ticlo/node` for server-side bindings) heavily depend on `@ticlo/core`.

For detailed implementation, always read `index.ts` to see what is exported to external packages.
