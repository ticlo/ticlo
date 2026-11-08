# Runtime lifecycle

A Library groups flows, modules, dependencies, and a shared context. A FlowModule
is a flow that exports reusable functions within a Library.

Code can define resident global Blocks before attaching storage. `setStorage()`
then reads global settings without starting stored flows. Startup selects main
libraries and ordinary flows:

```ts
await root.setStorage(storage);
await root.start({main: {flows: ['entry', 'jobs.**']}, shared: {}});
```

- Main libraries load their configured `autoLoadFlows`. Explicit `flows`
  selections take precedence, including `flows: []` to load none. For
  compatibility, bare `start()` / `start({})` still select all `#root` flows when
  `autoLoadFlows` is absent.
- Dependencies activate recursively with their auto-load modules, but do not
  auto-load ordinary flows. A library selected as a main root loads its
  auto-load flows even if another root depends on it. Cycles are allowed.
  Missing dependencies, required modules, or selected flows reject startup.
- Saved `#disabled` flags are honored. Call `stop()` before restarting a running runtime.

Patterns use policy `matchEditPath`: dot-separated paths, `*` within a segment,
`**` across segments, `?` for one or more digits. Trailing `.**` requires a
descendant. Selection runs once and excludes modules, folders, and future flows.
Missing exact names error; unmatched wildcards select nothing.

## Code-defined globals

Use `Root.defineGlobal()` in TS/TSX before `setStorage()` or `loadGlobal()`, in
either the browser or Node runtime:

```ts
const root = new Root();
root.defineGlobal('^environment', {
  apiBase: 'https://example.com/api',
  limits: {'#is': '', maxItems: 100},
});
await root.setStorage(storage);
await root.start();
```

The name may omit `^`. Ordinary flows inherit these Blocks through context, for
example `^environment.limits.maxItems`. The Block and every field declared by
code are read-only, including explicitly declared `undefined` values. Plain
objects and arrays are copied and frozen; class instances and `NoSerialize`
service objects keep their identity. Nested Block definitions use the usual
`#is` format and protect their declared fields independently.

Stored `#global` data and later reloads ignore overlapping values and bindings.
Fields absent from the code definition remain editable, including fields inside
nested Blocks. Saves contain only these editable additions, so code definitions
must be installed on every deployment. Definitions survive global disable/enable
and runtime stop/start; `root.destroy()` releases them. Duplicate definitions are
rejected.

A code-defined Block's `#is` describes its type without constructing or running
the ordinary function. Supply constant values or an already-created service
through fields such as `#output`; bindings in code definitions are not accepted.
This keeps host-owned services independent of executable Blocks loaded from
flows. For example, the HTTP host defines `^web-server` with type
`web-server:server` and the host's route service as its fixed `#output`.

## Library metadata

Remote/static storage read `proj/<library>/ticlo.json`:

```json
{"dependencies": ["shared"], "autoLoadModules": ["http", "scheduler"], "autoLoadFlows": ["entry", "jobs.daily"]}
```

Dependencies name libraries in the same storage; `autoLoadModules` and
`autoLoadFlows` list exact names, not globs. Missing fields/files mean empty arrays,
except for the legacy `#root` startup behavior above. Invalid metadata rejects
activation. File-server `.proj`
is separate project metadata; runtime storage never reads/writes it. Dependencies
do not use a `#deps` directory.

| Adapter | Metadata and persistence |
| --- | --- |
| `NodeStorage` | `<projectsDir>/#root/ticlo.json`, `<projectsDir>/main/ticlo.json` |
| Browser `local` | IndexedDB file `local/ticlo.json`; only the local project is stored in IndexedDB |
| `MemoryFlowStorage` | Metadata and serialized-flow Maps survive stop/start on the same instance |
| `StaticStorage` | Static projects are read-only; lifecycle persistence is allowed only for `local` |
| `RemoteStorage` | File server project metadata at `proj/<project>/ticlo.json` |

Adapters expose `getLibraryMetadata`, `saveLibraryMetadata`, and `listFlows`.
Catalog reads must not instantiate or run flows.

## Flow operations

```ts
const flow = {library: 'main', kind: 'flow', name: 'jobs.daily'} as const;
const module = {library: 'shared', kind: 'module', name: 'tools'} as const;

await root.loadFlow(flow);
await root.disableFlow(flow);                 // this run only
await root.enableFlow(flow, {persist: true});  // save #disabled: false
await root.unloadFlow(flow);

root.getFlowState(flow); // unloaded | loading | enabled | disabled
await root.listFlows('main'); // {name, state} entries
await root.listMainFlows(); // stored flows in manually selected libraries, with state and auto-load flag
await root.setAutoLoadModule('shared', 'tools', true);
await root.setAutoLoadFlow('main', 'entry', true);
```

Loading requires an enabled library and honors saved `#disabled` before
constructing executable blocks. Enable/disable requires a loaded flow. Temporary
overrides stay separate from saved data, even when saving other edits. Persistent
toggles write only `#disabled`, preserving unrelated unsaved edits. Enabled flows
execute according to their modes.

Ordinary modules load on demand in enabled libraries and stay loaded until
unloaded. Inactive libraries return empty workers without reading files.
Auto-load modules load on activation; disabled modules are read but neither run
nor expose callable definitions. Exported functions run only when called.
Auto-load flows load when their library is a main root. A saved `#disabled` flow
is loaded but does not run. Turning an auto-load flag on loads the flow immediately
only in a main library; turning it off leaves an already loaded flow open.
When a main root becomes dependency-only, flows started for that root are unloaded
after the unsaved-change check; manually loaded flows remain.

Disabling/unloading a module stops workers and clears outputs. References remain
subscribed and rebind when available. Explicit unload suppresses automatic reload
until explicit load or library reactivation. Auto-load flags persist; adding one
loads the module immediately in an active library, removing one does not unload it.

## Library operations

```ts
await root.enableLibrary('main', {flows: ['entry']});
await root.enableLibrary('other');
root.getLibraryGraph(); // {roots, dependencies}
await root.unloadLibrary('other');
await root.retainLibraries(['main']);
await root.switchLibrary('other');
await root.setLibraryDependencies('other', ['shared']);
await root.disableLibrary('main');
await root.disableLibrary('shared', {cascade: true});
await root.stop();
```

Switching activates the target and its dependencies, then unloads other active
libraries. Shared dependencies stay active. Switching loads the target's
auto-load flows. Unsaved edits in libraries to be closed
reject the switch. Disabling unloads the library's flows. Active dependents
require `cascade: true`; shared dependencies remain when a consumer stops.
Selections passed to `start()` and calls to `enableLibrary()` are manual roots.
`getLibraryGraph()` reports those roots and active dependency edges; cycles are
allowed. `unloadLibrary()` removes a manual root and unloads only libraries no
longer required by another root. `retainLibraries()` applies the same rule to a
set of roots and rejects dirty removals before unloading any of them.
In Designer and Dataflow Editor, the default library is the current page's
`project` query parameter; it is not a stored user preference.
Late reads cannot restore unloaded flows. Loaded sets, startup patterns, and
unload suppression are not saved.
Dataflow navigation can list every stored flow in a main library without loading
its file. An unloaded entry has no runtime block; opening it loads the flow and
then opens the live node. React page navigation shows loaded nodes only.
Changing dependencies saves `ticlo.json` and updates the active library at once:
new dependencies activate before unused dependencies unload. Unsaved changes in
dependencies to be removed reject the update.
`#global` remains available for settings/context but its stored executable blocks
are not started implicitly; put startup work in an auto-load module.

## Library context

Each named library owns a reserved `#context` flow, such as `+main.#context`,
saved as `#context.ticlo` in its library directory. A missing file supplies an
empty context. Its runtime type is `flow:context`. It supports values, blocks,
bindings, and local functions. Its block names are independent of the library's
ordinary flows and folders.
It is excluded from ordinary flow catalogs and startup patterns.

Context inheritance is one chain: local flow, parent flows/folders, library
`#context`, then root `#global`. Library lookups return the `#context` property
directly, without another mirror or parallel fallback. Each inherited property
listens only to its immediate upstream property. Worker instances keep the caller's
context even when their function is defined in another library.

Overrides apply to an entire `^name`, without merging object fields. Local values
including `null`, `false`, and `0`, or an explicit binding, override the inherited
value. A binding producing `undefined` remains an override. Removing the local
definition restores inheritance. Only local definitions and bindings are saved.

`setStorage()` completes the root `#global` read before startup. Activation loads
every used library's `#context` before auto-load modules and ordinary flows.
When startup knows several required files, their storage reads may run together;
the ordering applies to creating and running flows, not to network downloads.
Context blocks execute while their context flow is enabled; asynchronous results
propagate through normal bindings. Disabling a library or stopping the runtime
unloads ordinary flows and modules before clearing its context definitions.
Unsaved context edits block these operations unless discarded. Reenabling reloads
the saved context; the context flow object remains stable for existing subscribers.
The root library continues to use `#global`.

## Persistence

`FlowLoader.applyChange` / `Flow.applyChange()` return saved data or a promise.
Await saves before reporting success. Failures set `@save-error` and retain unsaved
state; `FlowHistory.saveCompleted()` keeps edits made during a pending save dirty.

Unload/stop never delete files. Unsaved edits block unloading unless
`{discardChanges: true}` is supplied. Use `Root.deleteFlow()` for deletion and
propagate its possible promise. Destroying runtime flows does not delete saved files.

## Client commands

`ClientConn` also exposes `getLibraryGraph`, `enableLibrary`, `unloadLibrary`,
`retainLibraries`, `getLibraryMetadata`, and `setLibraryDependencies`. Library
operations use names, such as `main` or `#root`; the connection maps them to
canonical runtime paths. Graph reads include `canLoad` and `hasMetadata`;
metadata reads include `canWrite`. These operations do not require an HTTP file
API. Readonly server connections filter graph reads and reject lifecycle edits.

`ClientConnection` exposes `loadFlow`, `unloadFlow`, `enableFlow`, `disableFlow`,
and `getFlowState` using paths (plus options where supported). Server policies
check these commands. Paths use the runtime tree: `+main.jobs.daily`,
`+shared.:tools`, or `:tools` for a root module. Root module function IDs use
`+#root:tools:function`; `+:tools:function` uses the calling flow's library.
