# Runtime lifecycle

`setStorage()` attaches storage and reads global settings. It does not start stored
flows. Select namespaces and ordinary flows explicitly:

```ts
await root.setStorage(storage);
await root.start({
  main: {flows: ['entry', 'jobs.**']},
  shared: {},
});
```

`start()` and `start({})` mean `start({'#root': {}})`. Empty or omitted `flows`
loads no ordinary flows. Dependencies activate recursively, including their Service
Libraries, but their ordinary flows need an explicit selection too. Cycles are
allowed. A missing dependency or required library rejects startup and tears down
the new runtime. Call `stop()` before starting again.

Patterns reuse policy `matchEditPath`: dot-separated logical paths, `*` within a
segment, `**` across segments, and `?` for one or more digits. A trailing `.**`
requires a descendant. Patterns select ordinary flows once at startup; they do
not select libraries, folders, or newly created flows. A missing exact flow name
is an error; an unmatched wildcard selects nothing.

## Namespace metadata

RemoteStorage and StaticStorage read each namespace's `ticlo.json`:

```json
{
  "dependencies": ["shared"],
  "serviceLibraries": ["http", "scheduler"]
}
```

File-server project management metadata remains in `_proj.json`; runtime storage
does not read or write it. There is no `#deps` directory lookup. Dependencies are namespace names in the same
storage. Service names are exact library names, not globs. Omitted fields mean
empty arrays. Existing projects without Ticlo metadata have no dependencies or
services. Invalid metadata rejects activation.

- FileFlowStorage uses `<dir>/ticlo.json` and `<dir>/+main/ticlo.json` with the same
  namespace configuration.
- IndexedDB uses a `namespaces` object store keyed by `#root`, `main`, etc.; its
  values are `{dependencies?, serviceLibraries?}`. The default database upgrades
  to version 2. A caller-supplied database must include this object store. Flow
  keys remain dotted.
- MemoryFlowStorage uses a namespace metadata Map and serialized flow Map. Values
  survive stop/start on the same storage instance.
- StaticStorage reads metadata but rejects persistent lifecycle mutations. Deploy
  edited JSON files to change its saved configuration.

Storage adapters expose `getNamespaceMetadata`, `saveNamespaceMetadata`, and
`listFlows`; catalog reads must not instantiate or run flows.

## Flow operations

```ts
const flow = {namespace: 'main', kind: 'flow', name: 'jobs.daily'} as const;
const library = {namespace: 'shared', kind: 'library', name: 'tools'} as const;

await root.loadFlow(flow);
await root.disableFlow(flow);                 // this run only
await root.enableFlow(flow, {persist: true});  // save #disabled: false
await root.unloadFlow(flow);

root.getFlowState(flow); // unloaded | loading | enabled | disabled
await root.listFlows('main'); // catalog entries: {name, state}
await root.setServiceLibrary('shared', 'tools', true);
```

Loading requires an enabled namespace and honors the saved `#disabled` before
constructing executable blocks. Enable/disable requires a loaded flow. Temporary
state is separate from saved data; saving other edits does not persist a temporary
state override. A persistent toggle writes only `#disabled`, preserving unrelated
unsaved edits. Enable means eligible to execute according to the flow's modes.

Ordinary libraries load on demand when called from an enabled namespace, and
remain loaded until explicitly unloaded. Inactive namespaces return empty workers
without reading library files. Service Libraries load on namespace activation;
a disabled service is read but does not execute or expose callable definitions.
Exported functions execute only when called, even inside a Service Library.

Disabling or unloading a library stops existing workers and clears their outputs.
References stay subscribed and rebind when the library becomes available again.
An explicit unload suppresses automatic reload for this run, until explicit load
or namespace reactivation. Changing the Service Library flag persists metadata;
marking a library as a service loads it immediately in an active namespace.
Removing the service flag does not unload it.

Unload and stop never delete stored files. Unsaved edits block unloading unless
`{discardChanges: true}` is supplied. Use `deleteFlow` for actual deletion.

```ts
await root.enableNamespace('main', {flows: ['entry']});
await root.disableNamespace('main');
await root.disableNamespace('shared', {cascade: true});
await root.stop();
```

Disabling a namespace unloads its flows. Active dependents prevent disabling it
unless `cascade: true` is specified. Shared dependencies are not automatically
removed when one consumer stops. Late storage reads cannot restore unloaded flows.
Loaded sets, startup patterns, and unload suppression are never persisted.

The client connection exposes `loadFlow(path)`, `unloadFlow(path, options)`,
`enableFlow(path, options)`, `disableFlow(path, options)`, and `getFlowState(path)`.
Client paths use the runtime tree: `+main.jobs.daily`, `+shared.:tools`, or
`:tools` for a root library. These commands are checked against server policies.
Root library function ids use `+#root:tools:function`; `+:tools:function` resolves
against the calling flow's namespace.

`#global` remains available for settings/context but its stored executable blocks
are not started implicitly. Move startup work into a Service Library.
