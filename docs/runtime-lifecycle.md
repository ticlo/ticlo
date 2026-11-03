# Runtime lifecycle

`setStorage()` attaches storage and reads global settings without starting stored
flows. Startup selects main namespaces and ordinary flows:

```ts
await root.setStorage(storage);
await root.start({main: {flows: ['entry', 'jobs.**']}, shared: {}});
```

- Main namespaces load their configured `autoLoadFlows`. Explicit `flows`
  selections take precedence, including `flows: []` to load none. For
  compatibility, bare `start()` / `start({})` still select all `#root` flows when
  `autoLoadFlows` is absent.
- Dependencies activate recursively with their auto-load libraries, but do not
  auto-load ordinary flows. A namespace selected as a main root loads its
  auto-load flows even if another root depends on it. Cycles are allowed.
  Missing dependencies, required libraries, or selected flows reject startup.
- Saved `#disabled` flags are honored. Call `stop()` before restarting a running runtime.

Patterns use policy `matchEditPath`: dot-separated paths, `*` within a segment,
`**` across segments, `?` for one or more digits. Trailing `.**` requires a
descendant. Selection runs once and excludes libraries, folders, and future flows.
Missing exact names error; unmatched wildcards select nothing.

## Namespace metadata

Remote/static storage read `proj/<namespace>/ticlo.json`:

```json
{"dependencies": ["shared"], "autoLoadLibraries": ["http", "scheduler"], "autoLoadFlows": ["entry", "jobs.daily"]}
```

Dependencies name namespaces in the same storage; `autoLoadLibraries` and
`autoLoadFlows` list exact names, not globs. The old `serviceLibraries` field is
read for compatibility and converted to `autoLoadLibraries` when metadata is
saved. Missing fields/files mean empty arrays, except for the legacy `#root`
startup behavior above. Invalid metadata rejects activation. File-server `_proj.json`
is separate project metadata; runtime storage never reads/writes it. Dependencies
do not use a `#deps` directory.

| Adapter | Metadata and persistence |
| --- | --- |
| `NodeStorage` | `<projectsDir>/#root/ticlo.json`, `<projectsDir>/main/ticlo.json` |
| Browser `local` | IndexedDB file `local/ticlo.json`; only the local project is stored in IndexedDB |
| `MemoryFlowStorage` | Metadata and serialized-flow Maps survive stop/start on the same instance |
| `StaticStorage` | Static projects are read-only; lifecycle persistence is allowed only for `local` |
| `RemoteStorage` | File server project metadata at `proj/<project>/ticlo.json` |

Adapters expose `getNamespaceMetadata`, `saveNamespaceMetadata`, and `listFlows`.
Catalog reads must not instantiate or run flows.

## Flow operations

```ts
const flow = {namespace: 'main', kind: 'flow', name: 'jobs.daily'} as const;
const library = {namespace: 'shared', kind: 'library', name: 'tools'} as const;

await root.loadFlow(flow);
await root.disableFlow(flow);                 // this run only
await root.enableFlow(flow, {persist: true});  // save #disabled: false
await root.unloadFlow(flow);

root.getFlowState(flow); // unloaded | loading | enabled | disabled
await root.listFlows('main'); // {name, state} entries
await root.listMainFlows(); // stored flows in manually selected namespaces, with state and auto-load flag
await root.setAutoLoadLibrary('shared', 'tools', true);
await root.setAutoLoadFlow('main', 'entry', true);
```

Loading requires an enabled namespace and honors saved `#disabled` before
constructing executable blocks. Enable/disable requires a loaded flow. Temporary
overrides stay separate from saved data, even when saving other edits. Persistent
toggles write only `#disabled`, preserving unrelated unsaved edits. Enabled flows
execute according to their modes.

Ordinary libraries load on demand in enabled namespaces and stay loaded until
unloaded. Inactive namespaces return empty workers without reading files.
Auto-load libraries load on activation; disabled libraries are read but neither run
nor expose callable definitions. Exported functions run only when called.
Auto-load flows load when their namespace is a main root. A saved `#disabled` flow
is loaded but does not run. Turning an auto-load flag on loads the flow immediately
only in a main namespace; turning it off leaves an already loaded flow open.
When a main root becomes dependency-only, flows started for that root are unloaded
after the unsaved-change check; manually loaded flows remain.

Disabling/unloading a library stops workers and clears outputs. References remain
subscribed and rebind when available. Explicit unload suppresses automatic reload
until explicit load or namespace reactivation. Auto-load flags persist; adding one
loads the library immediately in an active namespace, removing one does not unload it.

## Namespace operations

```ts
await root.enableNamespace('main', {flows: ['entry']});
await root.enableNamespace('other');
root.getNamespaceGraph(); // {roots, dependencies}
await root.unloadNamespace('other');
await root.retainNamespaces(['main']);
await root.switchNamespace('other');
await root.setNamespaceDependencies('other', ['shared']);
await root.disableNamespace('main');
await root.disableNamespace('shared', {cascade: true});
await root.stop();
```

Switching activates the target and its dependencies, then unloads other active
namespaces. Shared dependencies stay active. Switching loads the target's
auto-load flows. Unsaved edits in namespaces to be closed
reject the switch. Disabling unloads the namespace's flows. Active dependents
require `cascade: true`; shared dependencies remain when a consumer stops.
Selections passed to `start()` and calls to `enableNamespace()` are manual roots.
`getNamespaceGraph()` reports those roots and active dependency edges; cycles are
allowed. `unloadNamespace()` removes a manual root and unloads only namespaces no
longer required by another root. `retainNamespaces()` applies the same rule to a
set of roots and rejects dirty removals before unloading any of them.
In Designer and Dataflow Editor, the default namespace is the current page's
`project` query parameter; it is not a stored user preference.
Late reads cannot restore unloaded flows. Loaded sets, startup patterns, and
unload suppression are not saved.
Dataflow navigation can list every stored flow in a main namespace without loading
its file. An unloaded entry has no runtime block; opening it loads the flow and
then opens the live node. React page navigation shows loaded nodes only.
Changing dependencies saves `ticlo.json` and updates the active namespace at once:
new dependencies activate before unused dependencies unload. Unsaved changes in
dependencies to be removed reject the update.
`#global` remains available for settings/context but its stored executable blocks
are not started implicitly; put startup work in an auto-load library.

## Namespace context

Each named namespace owns a reserved `#context` flow, such as `+main.#context`,
saved as `#context.ticlo` in its namespace directory. A missing file supplies an
empty context. Its runtime type is `flow:context`. It supports values, blocks,
bindings, and local functions. Its block names are independent of the namespace's
ordinary flows and folders.
It is excluded from ordinary flow catalogs and startup patterns.

Context inheritance is one chain: local flow, parent flows/folders, namespace
`#context`, then root `#global`. Namespace lookups return the `#context` property
directly, without another mirror or parallel fallback. Each inherited property
listens only to its immediate upstream property. Worker instances keep the caller's
context even when their function is defined in another namespace.

Overrides apply to an entire `^name`, without merging object fields. Local values
including `null`, `false`, and `0`, or an explicit binding, override the inherited
value. A binding producing `undefined` remains an override. Removing the local
definition restores inheritance. Only local definitions and bindings are saved.

`setStorage()` completes the root `#global` read before startup. Activation loads
every used namespace's `#context` before auto-load libraries and ordinary flows.
When startup knows several required files, their storage reads may run together;
the ordering applies to creating and running flows, not to network downloads.
Context blocks execute while their context flow is enabled; asynchronous results
propagate through normal bindings. Disabling a namespace or stopping the runtime
unloads ordinary flows and libraries before clearing its context definitions.
Unsaved context edits block these operations unless discarded. Reenabling reloads
the saved context; the context flow object remains stable for existing subscribers.
The root namespace continues to use `#global`.

## Persistence

`FlowLoader.applyChange` / `Flow.applyChange()` return saved data or a promise.
Await saves before reporting success. Failures set `@save-error` and retain unsaved
state; `FlowHistory.saveCompleted()` keeps edits made during a pending save dirty.

Unload/stop never delete files. Unsaved edits block unloading unless
`{discardChanges: true}` is supplied. Use `Root.deleteFlow()` for deletion and
propagate its possible promise. Destroying runtime flows does not delete saved files.

## Client commands

`ClientConnection` exposes `loadFlow`, `unloadFlow`, `enableFlow`, `disableFlow`,
and `getFlowState` using paths (plus options where supported). Server policies
check these commands. Paths use the runtime tree: `+main.jobs.daily`,
`+shared.:tools`, or `:tools` for a root library. Root library function IDs use
`+#root:tools:function`; `+:tools:function` uses the calling flow's namespace.
