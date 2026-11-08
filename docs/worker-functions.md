# Workers

`packages/core/worker` implements flow-backed functions. `worker` selects its
source through `#use`; `map`, `handler`, and `multi-worker` use `use`.

## Sources and saves

| Source | Resolution | Save destination |
| --- | --- | --- |
| Inline object | Embedded flow definition | Owning worker field |
| Global ID | `globalFunctions` | Registered function definition |
| `:functionId` | Owning Flow's `#functions` / `FlowFunctionModule` | Local function definition |
| `+library:module:functionId` | `LibraryFunctionModule` | Module definition, optionally storage-backed |

String sources subscribe to function changes; replacement rebuilds their workers.
Missing sources wait for a valid definition. Preserve the caller's function module
when creating inline or local child flows. Worker instances inherit caller context,
even when the definition belongs to another Library.

Module saves await `LibraryFunctionModule.pendingSave`. Editor and worker save
callbacks must propagate promises so persistence failures retain dirty state.
See [flow examples](flow-format.md#examples) and
[save lifecycle](runtime-lifecycle.md#persistence).

## Flow classes and static content

`WorkerFlow` runs a definition; `RepeaterWorker` supports repeated hosts;
`FlowEditor` edits a definition through `#edit-*`. `Block.createOutputFlow()`
connects these flows to a `FunctionOutput` target.

Named workers share function-owned static data. Inline workers do not support it.
Ownership, loading, and persistence of `#static` and `#shared` are defined once in
[block controls](block-configs.md#worker-static-content-and-shared-ownership).
For editor descriptor lookup, pass the current `funcModule`; see
[connection scope](core.md#connection-layer).

## Hosts

| Host | Behavior |
| --- | --- |
| `WorkerFunction` | One worker; `#state` controls its lifecycle |
| `MapFunction` | Array/object results after workers complete; configurable pooling |
| `MultiWorkerFunction` | One worker per key; incremental results |
| `HandlerFunction` | Queued tasks; optional ordered completion |
| `SelectWorkerFunction` | Selects a downstream worker from a collector |

## Multi-worker

Replacing an array or object reuses workers with matching keys, updates their
inputs, and destroys removed workers. Changing `use` rebuilds all workers.
Arrays default to index keys; `key: 'id'` reuses workers by that item property.
Output remains in input order. Object and Block inputs use property names.

Item keys must be strings or numbers; numbers become strings. Invalid keys are
omitted. Duplicate keys produce at most one item; which duplicate wins is
unspecified. Clearing `key` restores index reuse. Array/object updates require
a new input reference; Block inputs also watch child changes.
