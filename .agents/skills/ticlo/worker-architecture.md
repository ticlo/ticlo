# Worker architecture

`packages/core/worker/` implements flow-backed functions. `WorkerHost` exposes a
`control: WorkerControl` and `workerField`: `+use` for `worker`, `use` for
`map`, `handler`, and `multi-worker`. Hosts usually connect
`WorkerControl.onUseChange` to a `StatefulFunction` input map.

## Sources and saves

| Source (`WorkerControl._src`) | Resolution | Save callback from `getSaveParameter()` |
| --- | --- | --- |
| Inline `DataMap` | Embedded flow definition | `saveInline()` writes `flow.save()` to the worker field |
| Global ID | `globalFunctions` | `WorkerFunctionGen.applyChangeToFunc(flow, src)` |
| `:functionId` | Owning flow's `#functions` / `FlowFunctionLib` | Same string-source callback |
| `+namespace:lib:functionId` | `NsFunctionLib`, optionally storage-backed | Same string-source callback |

Without a valid source, return `WAIT` or avoid creating a flow. String sources
subscribe to their `FunctionDispatcher`; factory changes set `_srcChanged` and
queue the host. Namespace saves await `NsFunctionLib.pendingSave`. Preserve and
await promises through worker/editor callbacks so failures leave changes unsaved.
See [file examples](./file-format.md#examples) for inline wrappers and local definitions.

## Flow classes and static content

- `WorkerFlow`: `FlowWithStatic` with type `flow:worker`; schedules `onReady`
  after inputs update and `#wait` clears.
- `RepeaterWorker`: worker used by repeated hosts.
- `FlowEditor`: editable `FlowWithStatic` under `#edit-*` properties.

Named workers save static content under `#static` (runtime type `flow:static`).
Its runtime owner is the library flow's `#shared` container, one child per
function. That `flow:const` container provides ownership/node-tree visibility
and is never serialized. Inline workers do not support static content.

Create workers through `Block.createOutputFlow()`:

```ts
this._data.createOutputFlow(RepeaterWorker, '#worker', src, outputTarget, saveCallback);
```

`outputTarget` implements `FunctionOutput`. `WorkerOutput` forwards child output,
readiness, and timeout to the host, which shapes the result.

Inline/in-flow child sources must retain their parent's function library.
For editor descriptor lookup, pass the current `funcLib` down; do not reconstruct
it from a deep block path. See [the `#lib` connection contract](./core-package.md#connection-layer).

## Host patterns

| Host | Behavior |
| --- | --- |
| `WorkerFunction` | One `#worker`; `+state`: `on`, `off`, `disable`, `lazy`; accepts `WorkerCollector` |
| `MapFunction` | Array/object results after all assigned workers are ready; fixed/unlimited pools, reuse, persist, timeout |
| `MultiWorkerFunction` | One worker per key; emits incremental results; watches child changes for Block inputs |
| `HandlerFunction` | Queues tasks; `keepOrder` uses `InfiniteQueue` to emit in call order |
| `SelectWorkerFunction` | Emits `WorkerCollector`; selects one downstream worker and disables others or applies their unused state |

`ThreadPool._pending` holds completed reusable workers; `_ready` holds slots whose
old flows were torn down. `UnlimitedPool` uses input keys as slots when possible,
preserving object-map identity.
