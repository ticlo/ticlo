# Runtime lifecycle

`setStorage()` attaches storage and reads global settings without starting stored
flows. Startup selects namespaces and ordinary flows:

```ts
await root.setStorage(storage);
await root.start({main: {flows: ['entry', 'jobs.**']}, shared: {}});
```

- `start()` / `start({})` select all ordinary `#root` flows, including nested
  folders: equivalent to `start({'#root': {flows: ['**']}})`.
- Explicit selections take precedence. Empty/omitted `flows` loads no ordinary
  flows; `start({'#root': {}})` starts only its Service Libraries.
- Dependencies activate recursively with their Service Libraries; their ordinary
  flows need explicit selection. Cycles are allowed. Missing dependencies or
  required libraries reject startup and tear down the new runtime.
- Saved `#disabled` flags are honored. Call `stop()` before restarting a running runtime.

Patterns use policy `matchEditPath`: dot-separated paths, `*` within a segment,
`**` across segments, `?` for one or more digits. Trailing `.**` requires a
descendant. Selection runs once and excludes libraries, folders, and future flows.
Missing exact names error; unmatched wildcards select nothing.

## Namespace metadata

Remote/static storage read `proj/<namespace>/ticlo.json`:

```json
{"dependencies": ["shared"], "serviceLibraries": ["http", "scheduler"]}
```

Dependencies name namespaces in the same storage; services are exact library
names, not globs. Missing fields/files mean empty arrays; invalid metadata rejects
activation. File-server `_proj.json` is separate project metadata; runtime storage
never reads/writes it. Dependencies do not use a `#deps` directory.

| Adapter | Metadata and persistence |
| --- | --- |
| `FileFlowStorage` | `<dir>/ticlo.json`, `<dir>/+main/ticlo.json` |
| IndexedDB | `namespaces` store keyed by `#root`, `main`, etc., with `{dependencies?, serviceLibraries?}` values; default DB version 2; custom DBs must provide the store; flow keys stay dotted |
| `MemoryFlowStorage` | Metadata and serialized-flow Maps survive stop/start on the same instance |
| `StaticFlowStorage` | Reads metadata; rejects persistent lifecycle mutations; update deployed JSON |

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
await root.setServiceLibrary('shared', 'tools', true);
```

Loading requires an enabled namespace and honors saved `#disabled` before
constructing executable blocks. Enable/disable requires a loaded flow. Temporary
overrides stay separate from saved data, even when saving other edits. Persistent
toggles write only `#disabled`, preserving unrelated unsaved edits. Enabled flows
execute according to their modes.

Ordinary libraries load on demand in enabled namespaces and stay loaded until
unloaded. Inactive namespaces return empty workers without reading files.
Service Libraries load on activation; disabled services are read but neither run
nor expose callable definitions. Exported functions run only when called.

Disabling/unloading a library stops workers and clears outputs. References remain
subscribed and rebind when available. Explicit unload suppresses automatic reload
until explicit load or namespace reactivation. Service flags persist; adding one
loads the library immediately in an active namespace, removing one does not unload it.

## Namespace operations

```ts
await root.enableNamespace('main', {flows: ['entry']});
await root.disableNamespace('main');
await root.disableNamespace('shared', {cascade: true});
await root.stop();
```

Disabling unloads the namespace's flows. Active dependents require `cascade: true`;
shared dependencies remain when a consumer stops. Late reads cannot restore
unloaded flows. Loaded sets, startup patterns, and unload suppression are not saved.
`#global` remains available for settings/context but its stored executable blocks
are not started implicitly; put startup work in a Service Library.

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
