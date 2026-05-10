---
name: ticlo-worker-architecture
description: Details on how WorkerControl and subflows work in Ticlo, specifically how worker flows are loaded, resolved, and saved. Local worker flows are stored in the '#functions' config property.
---

# Ticlo Worker Architecture

The `@ticlo/core/worker` package is responsible for flow-backed functions: reusable custom worker functions, inline worker definitions, repeaters such as `map`, and task handlers.

## WorkerControl and Worker Sources

At the heart of the worker architecture is `WorkerControl`, which manages how a subflow/worker source is loaded, watched, and saved.

Functions that host workers implement `WorkerHost` and expose:

- `workerField`: the field that stores the source (`use` for map/handler/multi-worker, `+use` for `worker`).
- `control`: the `WorkerControl` attached to the host function.

Worker hosts usually wire `WorkerControl.onUseChange` into a `StatefulFunction` input map.

The source (`src`) of a worker flow can take several forms, stored in `WorkerControl._src`:

1. **Inline `DataMap`**: The flow definition is stored directly in the worker field. Edits save back into that property.
2. **Global function id**: A plain string such as `add` or a generated worker id. It resolves through `globalFunctions`.
3. **Local flow function id**: `:functionId`, stored in the owning flow's `#functions` config and managed by its `PersistentFunctionLib`.
4. **Namespace function id**: `+namespace:lib:functionId`, stored in `NsFunctionLib` and optionally backed by `FlowStorage`.

Local flow functions have a descriptor lib. Flow-owned `PersistentFunctionLib.getScopePath()` returns the owning Flow path, while global and namespace libs return `null`. Worker and editor flows loaded from an in-flow function lib expose that owner path through the runtime-only context property `^#lib`, so UI code can watch descriptors with `watchDesc(':functionId', libPath)`.

For string sources, `WorkerControl` listens to the corresponding `FunctionDispatcher`; when the function definition changes, `_srcChanged` is set and the host block is queued.

## The `getSaveParameter()` Lifecycle

When the worker engine needs to create or apply changes to a worker flow, it calls `WorkerControl.getSaveParameter()`. This method must correctly determine the initial flow data (`src`) and the `saveCallback` based on `_src`:

- If `src` is a string, `saveCallback` calls `WorkerFunctionGen.applyChangeToFunc(flow, src)`.
- If `src` is inline data, `saveCallback` calls `saveInline()`, which writes `flow.save()` back into the host block's worker field.
- If no valid source exists, the host should return `WAIT` or avoid creating a flow.

## Flow Classes

- `WorkerFlow`: a `FlowWithShared` with `flow:worker` config. It schedules `onReady` after inputs update and `#wait` clears.
- `RepeaterWorker`: a `WorkerFlow` used by repeated hosts. With inline data and `#cacheMode`, it can key shared blocks off the host's `#shared` property.
- `FlowEditor`: an editable `FlowWithShared` created under `#edit-*` properties. It never globally caches its shared block during editing.

Workers are spawned through `Block.createOutputFlow()`:

```ts
this._data.createOutputFlow(RepeaterWorker, '#flow', src, outputTarget, saveCallback);
```

The output target implements `FunctionOutput`, so each host can decide how child flow outputs are collected.

When passing in-flow or inline worker sources into a child flow, keep the parent flow's function lib attached so `^#lib` continues to point at the function owner. Do not rediscover the lib from a deep block path in editor code; Block view should pass its current `funcLib` down to descriptor consumers.

## Host Patterns

- `WorkerFunction`: creates one child flow at `#flow`. `+state` controls `on`, `off`, `disable`, or `lazy`. It can participate in `select-worker` via `WorkerCollector`.
- `MapFunction`: maps array/object input to multiple worker runs and emits a final array/object when every assigned worker is ready. It supports fixed thread pools, unlimited keyed workers, reuse, persist, and timeout.
- `MultiWorkerFunction`: maintains one worker per input key and updates output as individual child workers change. If the input is a `Block`, it watches child property changes.
- `HandlerFunction`: queues calls/tasks and assigns them to workers. With `keepOrder`, it stores results in an `InfiniteQueue` and emits completed tasks in original call order.
- `SelectWorkerFunction`: emits a `WorkerCollector`; downstream `worker` blocks use it to turn one named worker on and set others to `disable` or the configured unused state.

## Thread Pools and Output

`ThreadPool` is a fixed-size slot allocator. `_pending` stores completed workers that can be reused without destroying their flow; `_ready` stores slots whose old flow has been torn down. `UnlimitedPool` uses the input key itself as the slot when possible, which preserves stable identity for object maps.

`WorkerOutput` sits between a child worker flow and the host function. Child flow outputs do not write directly to the host block; the host receives readiness/timeout callbacks and chooses how to shape the final result.
