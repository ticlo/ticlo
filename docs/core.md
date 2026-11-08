# Core runtime

`@ticlo/core` owns Blocks, bindings, scheduling, persistence boundaries, and the
client/server protocol. Built-ins register through `packages/core/index.ts`.

## Blocks and bindings

A `Block` owns named `BlockProperty` values and an optional `#is` function.
`_saved` holds persisted data; `_value` holds runtime data. Either may refer to
an owned child Block. Replacing an owned child destroys it.

| Mutation | Effect |
| --- | --- |
| `setValue()` | Updates saved and runtime values and removes the binding |
| `updateValue()`, `setOutput()` | Update runtime state, preserving saved data |
| `setBinding()` | Clears saved data and subscribes to a source; saves the path |

Bindings resolve relative to the owning Block. Dotted paths use cached binding
chains through children and object fields. `propRelative()` generates portable
paths across flow boundaries, Library roots, and static data. See
[flow format](flow-format.md) for prefixes and serialization.

Property listeners receive the current value when attached. `onSourceChange`
is optional; when provided, it receives the source property or `null` on destruction.

## Functions and execution

`Library.getFunctions(id, flow)` resolves global, flow-local, and Library function
IDs. `FunctionModule.addFactory()` registers class-backed or descriptor-only
functions; `add()` accepts an existing factory. `getDesc()` reads a descriptor;
`getDescToSend()` also computes its serialized size for transport. Local runtime
lookups should use `getDesc()`.

Descriptor execution defaults are copied to the function prototype. Dynamic
metadata belongs in `factory.meta`, read through `getMeta()`. Function inputs
initialize after the Block's properties load.

`Resolver` batches work into four priority queues. `PromiseWrapper` suppresses
stale asynchronous results. `PureFunction` clears output on cleanup;
`StatefulFunction` routes changed inputs through its input map. See
[execution controls](block-configs.md) and [worker contracts](worker-functions.md).

## Flows and persistence

`Flow` is a save/load boundary. Embedded `Flow._save()` returns `undefined`;
use `flow.save()` and save nested flows separately. `Root` owns `#global` for
settings/context and `#temp` for generated flows.

`FlowHistory` tracks edits and undo/redo. Runtime loading must not record edits
or serialize the Flow for each function registration. Storage reads, startup,
unload checks, asynchronous saves, and lifecycle state are defined in
[runtime lifecycle](runtime-lifecycle.md). File adapters implement the shared
[storage contracts](remote-storage.md).

## Connection layer

`makeLocalConnection()` serializes by default to match remote transport; its
`serialize` option can pass values by reference. Frames batch until the estimated
`WS_FRAME_SIZE`; one message may exceed it. Nonempty frames require an
acknowledgement, which may be empty. Empty acknowledgements require no reply.

`ClientConnection` merges pending non-important `set`, `update`, and `bind`
requests by path. Subscription caches support reconnect clears and replay.
Full-value subscriptions wait for the WebSocket snapshot and reuse complete
cached values. Only truncated snapshots trigger a full-value read (HTTP on a
mixed connection); listeners share that read, and outdated responses cannot
replace newer subscription values.
`ServerConnection` dispatches requests to its one-argument command methods and
awaits asynchronous results. Server policies enforce access independently of
client restrictions; storage-backed commands must propagate promises.

`ServerSubscribe` watches values, bindings, listener dots, and errors;
`ServerWatch` watches children and history; `ServerDescWatcher` watches function
descriptors. A Flow using `FlowFunctionModule` exposes its owner through runtime
`#module`. Clients receive a `NoSerialize` Block whose `value` is the Flow path.
Pass it as `funcModule` for local descriptor lookup, including
`ClientConn.watchDesc(id, funcModule)`. Standalone editor components use global
lookup unless given this path.
