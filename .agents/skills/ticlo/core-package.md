# Ticlo Core Package Architecture

The `@ticlo/core` package is the runtime engine for Ticlo flows. It owns block-tree data, binding resolution, function registration, scheduling, persistence boundaries, worker subflows, and the client/server sync protocol used by the editor.

## Directory Structure

- `block/`: Runtime primitives. `Block` hosts properties and functions; `Flow` is the persistence/execution boundary; `BlockProperty` stores saved vs runtime state; `BlockBinding` resolves dotted bindings; `FunctionGroup` and `Namespace` register and resolve functions.
- `connect/`: Batched request/response protocol for editor and client APIs. `ClientConnection` creates requests and caches subscriptions; `ServerConnection` dispatches commands into a `Root`; `LocalConnection` loops both sides together through serialization for tests/local UI.
- `functions/`: Built-in function nodes. Most are small `PureFunction` or `BaseFunction` classes registered into `globalFunctions`; date/time functions use `AutoUpdateFunction` to schedule future runs.
- `worker/`: Flow-backed functions. `WorkerFunction`, `MapFunction`, `MultiWorkerFunction`, and `HandlerFunction` create child `WorkerFlow`/`RepeaterWorker` instances and route inputs/outputs through `WorkerControl`.
- `property-api/`: Editor mutation helpers for custom/optional/group properties, copy/paste, rename/move, and property visibility order (`@b-p`).
- `util/`: Serialization (`arrow-code`), path math, relative binding generation, equality/clone helpers, date/time settings, logging, schedule timers, and value truncation for transport.

## Runtime Model

### Blocks and Properties

`Block` is both a data node and a function host. Every property is a `BlockProperty` with:

- `_saved`: the value that will be serialized, usually from user/editor changes.
- `_value`: the current runtime value, which may be a computed output.
- `_bindingSource` / `_bindingPath`: a live subscription that drives `_value` from another property.

Objects with `#is` or `~#is` are interpreted as child block data. If such an object must remain a plain value, `BlockProperty._saveValue()` wraps it as `{ "#is": <object> }` to remove ambiguity on load.

Property prefixes are runtime contracts:

- `#`: engine config and control, such as `#is`, `#call`, `#outputs`, `#wait`.
- `~`: binding/helper block data. `~foo` stores a helper block whose `#output` drives `foo`.
- `^`: context property linked to parent/global context.
- `@`: editor-only metadata.
- `+`: function-specific config.
- no prefix: normal IO.

### Binding

Bindings are dotted paths resolved relative to the owning block. Single-segment bindings listen directly to a property. Multi-segment bindings are cached as `BlockBinding` chains; each segment follows either a child `BlockProperty` or a plain object field. `propRelative()` generates portable relative paths and has special handling for flow boundaries, namespaces (`#+`), and `#shared`.

### Function Lifecycle

`#is` selects a function class through `Namespace.getFunctions()`:

- `:local` resolves against the current flow's `#functions` group.
- `+namespace:group:name` resolves against namespace worker groups.
- other non-empty ids resolve against `globalFunctions`.

Function descriptors are registered through `FunctionGroup.add()`. Descriptor defaults are copied to the function prototype for fast access to priority and default mode. During block load, function construction is deferred until all properties are loaded so `initInputs()` sees stable data.

`FunctionGroup.getScopePath()` returns the Flow path that owns a local in-flow function group, or `null` for global and namespace groups. Flow-owned `PersistentFunctionGroup` instances use this to expose the runtime-only context property `^#scope`. Editor descriptor watches for in-flow functions must pass this scope path to `ClientConn.watchDesc(funcId, scopePath)`; otherwise only global descriptors are visible.

Function modes:

- `auto`: use function default.
- `onLoad`: run on load, changes, and calls.
- `onChange`: run on changes and calls.
- `onCall`: run only when `#call` receives a trigger.

The `Resolver` batches queued blocks into four priority queues. Async function results are guarded by `PromiseWrapper`, so stale promise completions cannot emit after a newer run has replaced them.

### Flows and Root

`Flow` extends `Block`, but it is a persistence boundary. A flow's `_save()` returns `undefined` when embedded in a parent block; callers must use `flow.save()` explicitly. Root owns three special const flows:

- `#global`: global context/settings.
- `#temp`: transient generated flows.
- `#shared`: reusable shared subflows.

`FlowHistory` watches flow-level changes for undo/redo and debounces edits. Server mutations use `trackChange()` to pick the right flow boundary, including special handling for synced block-position attributes and shared-block edits.

## Connection Layer

`Connection` batches `ConnectionSendingData` into frames capped by `WS_FRAME_SIZE`. A receive cycle forces an acknowledgement frame, even with no payload, so both sides can continue draining queued sends.

`ClientConnection` exposes the editor API. Non-important `set`, `update`, and `bind` requests are merged by path until serialized. Subscriptions and watches keep client-side caches so reconnects can produce coherent clears/replays.

`ServerConnection` receives `{cmd, id, path, ...}` maps and dispatches only one-argument methods defined on `ServerConnection`. Long-lived server requests include:

- `ServerSubscribe`: property value, binding, listener-dot, and error updates.
- `ServerWatch`: block child structure updates plus flow history tracking.
- `ServerDescWatcher`: function descriptor updates globally or for a local flow function group.

In Block view, `BlockStage` owns the current function scope and passes it to `PropertyList`, block renderers, and function selectors. Standalone editor components should keep global descriptor behavior unless a `funcScope` is explicitly supplied.

## Built-In Functions

Built-ins register themselves from `packages/core/index.ts`. Function code usually lives in a small class plus a descriptor. `PureFunction` clears output on cleanup. `StatefulFunction` can use `getInputMap()` to handle selected input changes without re-running for every property.

Important groups:

- `math`, `string`, `condition`, and `data`: straightforward pure/state helpers.
- `script`: JS execution through a controlled function block.
- `date/time`: Luxon-based parsing/formatting, timers, delays, and scheduler events.
- `web-server` and `http`: request/route/fetch primitives used by server packages.
- `worker`: flow-backed custom functions and repeat/handler patterns.

## Editing Helpers

The property API mutates block metadata and saved data in ways that preserve runtime semantics:

- `PropertyMover` snapshots saved value or binding, clears the old property, recreates it under a new name, and can update outbound bindings.
- `CopyPaste` separates `#shared` payloads from normal block payloads, renames colliding pasted blocks, adjusts bindings, and offsets stage coordinates to avoid overlap.
- `PropertyShowHide` maintains `@b-p` display order from descriptor, optional, and custom-property order.
