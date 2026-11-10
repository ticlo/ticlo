# Core runtime

`@ticlo/core` owns Blocks, bindings, scheduling, persistence boundaries, and the
client/server protocol. Built-ins register through `packages/core/index.ts`.

## Blocks and bindings

A `Block` owns named `BlockProperty` values and an optional `#is` function.
`_saved` holds persisted data; `_value` holds runtime data. Either may refer to
an owned child Block. Replacing an owned child destroys it.

| Mutation                       | Effect                                                       |
| ------------------------------ | ------------------------------------------------------------ |
| `setValue()`                   | Updates saved and runtime values and removes the binding     |
| `updateValue()`, `setOutput()` | Update runtime state, preserving saved data                  |
| `setBinding()`                 | Clears saved data and subscribes to a source; saves the path |

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

### Errors and runtime status

Blocks publish completion through `#emit` and pending work through `#wait`.
Thrown exceptions become `ErrorEvent` values with type `SyncError`; rejected
promises use `AsyncError`. Existing `ErrorEvent` values pass through unchanged,
including when thrown or rejected. Their constructor defaults to `error` when
no type is supplied.
Failures are retained even without a subscriber; later emissions replace them.
`emitOnly()` changes the event without ending the current wait state.

Arrow encodes `ErrorEvent` with the `E` tag and native JavaScript errors with
`e`. Compact array payloads preserve event types and details, including native
error names, messages, and driver codes. Stack traces and event loop IDs are
omitted. Decoding restores an `ErrorEvent` and its error semantics. Connection
previews preserve recognizable errors while truncating large details to the
value budget; `isDataTruncated()` recognizes these error previews.

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
`serialize` option can pass values by reference. Local and Frame server
connections accept `ConnectionOptions` with independent `maxMessageSize`
(default 524288) and `maxValueSize` (default 1024). Both must be positive safe
integers with `maxValueSize < maxMessageSize`:

```ts
const options = {maxMessageSize: 1024 * 1024, maxValueSize: 64 * 1024};
makeLocalConnection(root, true, undefined, true, options);
new FrameServerConnection(editorWindow, root, options);
```

Limits apply to server output and Local reconnects preserve them. Value previews
use the value budget for strings, collection traversal, and encoded references;
there is no fixed collection-length cap. Full-value reads remain complete.
Descriptors split using the message budget. Sizes are estimates, not exact
encoded byte counts. Frames batch until `maxMessageSize`; one message may exceed
it. Nonempty frames require an
acknowledgement, which may be empty. Empty acknowledgements require no reply.

Truncated array previews end with two metadata entries, `TRUNCATED` and the
original array length. These are not array items. `getTruncatedArrayLength()`
reads that length; `isDataTruncated()` recognizes the pair. Every truncated
nested array carries its own length, including arrays whose items were all
visited but contain truncated children. Discovery stays within the preview
budget and does not enumerate omitted rows or object fields.

`ClientConnection` merges pending non-important `set`, `update`, and `bind`
requests by path. Subscription caches support reconnect clears and replay.
Full-value subscriptions wait for the WebSocket snapshot and reuse complete
cached values. Only truncated snapshots trigger a full-value read (HTTP on a
mixed connection); listeners share that read, and outdated responses cannot
replace newer subscription values.

`getValuePage(path, {offset, limit, anchor?, select?})` reads a complete array
slice and returns `{items, offset, total, keys?}`. `select` traverses own keys of
plain objects and arrays inside the property's value; it also works with
`getValue`, for example `getValue(path, {select: ['columns']})`. Both use the
existing `get` command and its access policy. Pages bypass preview truncation.

Start at offset zero. To continue, send the preceding page's last row as `anchor`
and the number of loaded rows as `offset`. The server compares it with the row
at `offset - 1` using `deepEqualTransport`; a mismatch or shortened array returns
`page_anchor_mismatch`. This checks continuity at the boundary, not a snapshot of
the whole table. Keep an independent anchor snapshot when a local connection
passes mutable references. A partial first page of object rows includes `keys`,
the union of the whole array's first and last row keys.

`ServerConnection` dispatches requests to its one-argument command methods and
awaits asynchronous results. Server policies enforce access independently of
client restrictions; storage-backed commands must propagate promises.

Function commands return named values in an object, synchronously or as a Promise. `executeCommand` waits before
returning `{result}`; a null or undefined result retains the existing Flow change
tracking behavior. Thrown command errors preserve native Error details through
Arrow encoding. Callback callers still receive a string message and may inspect
`data.error`; Promise callers receive the transported Error when available.

`FunctionCommandDesc.parameters` describes named arguments. Its optional `results`
array describes named return values using property descriptors. Handlers return
an object keyed by those names; the connection adds its `{result: values}` wrapper.
Tables use the existing `rowType` and `columns` descriptors,
or carry dynamic columns in their returned `{columns, rows}` value. These schemas
describe editor presentation; they do not transform or validate command data.

`FunctionCommandDesc.largeData` indicates potentially large arguments or results.
Callers pass it in the fifth argument of `ClientConn.executeCommand`, leaving
callbacks as the fourth argument. The connection chooses the transport:
mixed browser connections use HTTP for commands marked `largeData`, otherwise
WebSocket; local and frame connections ignore the hint. A failed HTTP command
is not retried over WebSocket. `hidden` omits a command from generic menus for dedicated UIs.
`readonly` identifies commands that need no writable Flow storage; implementations
must still honor the server's readonly flag for any writes.

`ServerSubscribe` watches values, bindings, listener dots, and errors;
`ServerWatch` watches children and history; `ServerDescWatcher` watches function
descriptors. A Flow using `FlowFunctionModule` exposes its owner through runtime
`#module`. Clients receive a `NoSerialize` Block whose `value` is the Flow path.
Pass it as `funcModule` for local descriptor lookup, including
`ClientConn.watchDesc(id, funcModule)`. Standalone editor components use global
lookup unless given this path.
