# File and flow storage

`RemoteStorage`, `StaticStorage`, and `NodeStorage` implement `FlowStorage` and
the shared file interfaces. Pass the same instance to `Root.setStorage()` and
`FileManager`. Remote and static adapters live in `@ticlo/remote-storage`; the
filesystem adapter lives in `@ticlo/node`.

```ts
const storage = new RemoteStorage({baseURL: 'http://127.0.0.1:8010/file'});
await root.setStorage(storage);
await root.start({main: {flows: ['entry']}});
```

`RemoteStorage` accepts a custom `fetch` and preserves native cancellation.
`TicloFileClient` exposes the lower-level Axios HTTP API. Server hosting,
authentication, conditional HTTP headers, and Git logging are defined in
[file server](file-server.md); startup and Flow state are in
[runtime lifecycle](runtime-lifecycle.md).

## Paths and scopes

Public storage paths use `<project>/<relative-path>`, without `proj/`.
`storage.user` uses paths relative to the current user's directory. Paths reject
traversal and backslashes. Operations return promises and accept `AbortSignal`.

| Scope | Remote | Static | Node |
| --- | --- | --- | --- |
| Browser project `main` | `proj/main/` | `proj/main/`, read-only | — |
| Server project `main` | `ScopedFileServerFiles` with `serv` | — | `<dir>/main/` |
| Project `local` | IndexedDB | IndexedDB | `<dir>/local/` |
| Current user | `usr/<authenticated-id>/` | `usr/guest/`, read-only | `<dir>/#root/` |
| Global flow | `storage.user/#global.ticlo` | `storage.user/#global.ticlo` | `<dir>/#root/#global.ticlo` |

Browser `local` is reserved, always available, and cannot be deleted or moved as
a project. Its files never fall back to a remote project. Local file metadata and
contents change in one IndexedDB transaction; empty directories are preserved.
Backups of failed remote saves are separate from this project.

`#global` always uses `storage.user`; a missing file means an empty global Flow.
Library context remains `<project>/#context.ticlo`.

For server runtime editing, `editor.html?host=http://127.0.0.1:8010/` resolves
`/ticlo` and `/file` in the `serv` scope. An explicit `/ticlo` URL also resolves
its sibling file endpoint. `RemoteStorage` uses `proj`; `ScopedFileServerFiles`
implements file and Git access for `serv`, while the server runtime uses
`NodeStorage`. It does not implement `FlowStorage`.
Its `listProjects` and `createProject` methods use that same scope for Library
catalog access; they do not activate the created Library.

`project=<id>` selects the file tree; a qualified Flow path selects its Library.
The default is `#root`. Hosts notify external writes with
`notifyFileChange(path)`; passing a project invalidates its expanded tree.
After Git reset, the editor reloads `listLoadedFlows(library)`, including modules
and Flows without open tabs. Uploading files alone does not reload running Flows.

## File operations and persistence

[FileAccess.ts](../packages/core/storage/FileAccess.ts) defines file operations,
project metadata, optional Git capabilities, and errors. `.proj` is project
management metadata; `ticlo.json` is runtime Library metadata. Writable adapters
migrate legacy `_proj.json` when a project is read.

Reads return `{data, revision?, contentType?, localBackup?}`; writes return
`{revision?}`. `revision: null` creates only; a string requires that revision;
omitting it overwrites intentionally. Runtime saves retain their own revision,
independent of file preview reads. Conflicts preserve unsaved state. Flow writes
are ordered per key.

Copies preserve directories, including empty ones. Moves copy before removing
the source and can partially succeed across backends. Failures do not retry or
overwrite automatically. `StorageError.code` distinguishes not-found, conflict,
read-only, permission, path, and I/O failures. `getCapabilities(path)` reports
write and persistence support. Static sources cannot be modified; copy to `local`
to edit. See [static indexes](static-storage.md) for deployment requirements.

`subscribeFileChanges(listener)` reports successful writes through that instance
and returns an unsubscribe function. It does not watch other tabs or external
writers. Those hosts must notify changes explicitly.

## Backups and Git

Failed editor-generated Flow, metadata, and new-file saves retain a browser backup
and report the original error. Reads prefer that backup across reloads, including
offline. Keys include server URL, user, and path; the last known user is retained
for offline discovery. A successful save or explicit discard clears the backup.
Native file uploads do not create editor backups.

`RemoteStorage`, `ScopedFileServerFiles`, and `NodeStorage` offer the shared
`ProjectGit` API. Browser `local` and static projects do not. Working-tree status
is independent of editor backups; remote adapters include backups in pending
changes. Git reset discards those backups after the server reset succeeds.
See [Git contracts](file-server.md#project-git).

## Runtime file layout

| Relative project path | Purpose |
| --- | --- |
| `ticlo.json` | Library dependencies and auto-load settings |
| `#context.ticlo` | Library context |
| `folder/child.ticlo` | Flow `folder.child` |
| `#modules/tools.ticlo` | Module `tools` |
| `#storage/key.str` | String storage functions |

`#root` holds unqualified Flows; named projects map to `+project.flow`.
`#modules`, `#deps`, and `#storage` are reserved root folder names. Ordinary
`modules`, `deps`, and `storage` folders are allowed. Catalog reads do not run
Flows. `read-storage` and `write-storage` use the caller's project; detached
runtimes use memory. Their listeners report writes through that instance.

See [development](development.md) for local hosts and style/build commands.
