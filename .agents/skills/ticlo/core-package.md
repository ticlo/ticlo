# Core architecture

`@ticlo/core` owns the reactive block tree and editor synchronization.

## Directory structure

| Directory | Responsibility |
| --- | --- |
| `block/` | Blocks, flows, properties, bindings, function libraries, namespaces, resolver |
| `connect/` | Batched client/server protocol and in-process local connections |
| `functions/` | Built-ins registered through `packages/core/index.ts` |
| `worker/` | Flow-backed functions; see [workers](./worker-architecture.md) |
| `policy/` | Client restrictions and independent server enforcement; editor restrictions do not secure a server |
| `property-api/` | Custom/optional/group properties, copy/paste, move/rename, visibility |
| `util/` | Serialization, paths, equality/cloning, dates, timers, logging, transport truncation |

## Blocks and bindings

`Block` hosts properties and an optional function. `BlockProperty` separates
saved data (`_saved`), runtime data (`_value`), and binding subscriptions
(`_bindingSource`/`_bindingPath`). See [property mutations](../../../packages/core/block/README.md)
and [file format](./file-format.md) for persistence markers and prefixes.

Bindings resolve relative to the owning block. Single segments listen directly
to a property; dotted paths use cached `BlockBinding` chains through child
properties or plain object fields. `propRelative()` handles flow boundaries,
namespaces (`#+`), and `#static` when generating portable paths.

## Functions and execution

`Namespace.getFunctions()` resolves `#is` IDs; see [function IDs](./file-format.md#function-ids).
Register class-backed or descriptor-only functions with
`FunctionLib.addFactory(cls, desc, namespace?, functionApi?, options?)`.
Use `FunctionLib.add(factory, namespace?, functionApi?)` for existing factories.

Descriptor defaults are copied to `factory.cls.prototype` (priority, mode, type,
purity). Dynamic metadata belongs in `factory.meta`, read with `factory.getMeta(key)`
or `FunctionLib.getMeta(id, key)`. Construction waits until all block properties
load so `initInputs()` sees stable data.

`Resolver` batches blocks into four priority queues. `PromiseWrapper` prevents
stale async completions from emitting after a newer run. See
[execution modes and calls](../../../docs/block-configs.md).

`PureFunction` clears output on cleanup. `StatefulFunction.getInputMap()` handles
selected input changes. `AutoUpdateFunction` schedules future runs, including
Luxon-based date/time functions.

## Flows and persistence

`Flow` is a save/load boundary: embedded `Flow._save()` returns `undefined`;
use `flow.save()` and save nested flows separately. `Root` owns `#global` for
settings/context and `#temp` for transient generated flows.

`FlowHistory` debounces edits and tracks undo/redo. Server `trackChange()` selects
the flow boundary, including synced positions and static-block edits. See
[worker static ownership](./worker-architecture.md#flow-classes-and-static-content)
and [save/lifecycle rules](../../../docs/runtime-lifecycle.md).

`Storage` holds strings; `FlowStorage` handles flows and libraries. Adapters live
in `html` (IndexedDB/static HTTP), `node` (filesystem), and `remote-storage`
(writable HTTP). Their layouts differ; use the adapter's reference.

## Connection layer

`makeLocalConnection()` serializes by default to match remote transport;
its `serialize` option can pass values by reference instead.

`Connection` batches `ConnectionSendingData` until estimated size reaches
`WS_FRAME_SIZE`; a single message may exceed it. Nonempty frames require an
acknowledgement, which may be empty; empty acknowledgements require no reply.

`ClientConnection` merges non-important `set`, `update`, and `bind` requests by
path until serialization. Subscription/watch caches support reconnect clears
and replays. `ServerConnection` dispatches `{cmd, id, path, ...}` only to its
one-argument methods and awaits async results before sending completion/errors.
Storage-backed commands must propagate promises.

| Server request | Watches |
| --- | --- |
| `ServerSubscribe` | Values, bindings, listener dots, errors |
| `ServerWatch` | Child structure and flow history |
| `ServerDescWatcher` | Global or flow-local function descriptors |

Flows using `FlowFunctionLib` expose its owner through runtime-only `#lib`.
Clients receive a `NoSerialize` Block whose `value` is the Flow path; pass that
path to `ClientConn.watchDesc(funcId, libPath)` for local descriptors.
`BlockStage` passes its `funcLib` to property lists, renderers, and selectors.
Standalone components retain global lookup unless given a `funcLib`.

## Editing helpers

- `PropertyMover` snapshots saved values/bindings, recreates the property under
  its new name, and can update outbound bindings.
- `CopyPaste` separates static payloads, renames collisions, adjusts bindings,
  and offsets coordinates.
- `PropertyShowHide` derives `@b-p` order from descriptor, optional, and custom properties.
