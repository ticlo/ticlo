---
name: ticlo-worker-architecture
description: Details on how WorkerControl and subflows work in Ticlo, specifically how worker flows are loaded, resolved, and saved. Local worker flows are stored in the '#functions' config property.
---

# Ticlo Worker Architecture

The `@ticlo/core/worker` package is responsible for handling execution of subflows (workers) asynchronously or repeatedly (e.g., `map`, `worker`, `multi-worker`).

## WorkerControl and Worker Sources

At the heart of the worker architecture is the `WorkerControl` class, which manages how a subflow or worker is loaded, bound to a block, and saved.

Functions that host workers (like `WorkerFunction`, `MapFunction`) implement the `WorkerHost` interface and have a `workerField` (typically `use` or `+use`).

The source (`src`) of a worker flow can take several forms, stored in `WorkerControl._src`:

1.  **Inline DataMap**: The flow definition is stored directly in the `use` field as a JSON object (`DataMap`). The subflow is saved back directly into the parent block's property.
2.  **Function Reference (String)**: A string reference to a registered function.
    - `":local-function"`: Points to a function in the local flow.
    - `"+namespace:function"`: Points to a function in a specific namespace.
    - `"global-function"`: Points to a globally registered function.
    - When using string references, `WorkerControl` listens to the `FunctionDispatcher` (via `Namespace.getFunctions()`) to watch for changes.
3.  **Local Flow Functions (`:functionId`)**: A string reference to a local function defined within the flow's `#functions` config property (e.g., `:my-worker`).
    - The function content is managed by the flow's `_funcGroup`.
    - `WorkerControl` observes these localized descriptors and spawns flows identically to global functions.

## The `getSaveParameter()` Lifecycle

When the worker engine needs to create or apply changes to a worker flow, it calls `WorkerControl.getSaveParameter()`. This method must correctly determine the initial flow data (`src`) and the `saveCallback` based on `_src`:

- **If `src` is a regular string (Function ID)**:
  - The `src` remains the string.
  - The `saveCallback` calls `WorkerFunctionGen.applyChangeToFunc(flow, src)` to update the registered function.
- **If `src` is an inline `DataMap`**:
  - The `src` is the DataMap itself.
  - The `saveCallback` uses `this.saveInline` to write the JSON back to the parent block's property.

## Execution via createOutputFlow

Once the parameters are resolved, a `WorkerFlow` (or its subclass like `RepeaterWorker`) is spawned using the block execution API:

```typescript
this._data.createOutputFlow(RepeaterWorker, '#flow', src, outputField, saveCallback);
```

This creates the isolated child flow tree. Standard execution then involves sending inputs via `worker.updateInput()`, resolving results, and handling execution modes contextually (e.g., `WorkerMode.ON`, `OFF`, `DISABLE`).
