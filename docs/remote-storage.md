# File and flow storage

`RemoteStorage` and `StaticStorage` from `@ticlo/remote-storage`, and `NodeStorage`
from `@ticlo/node`, provide file operations and implement the runtime's
`FlowStorage` interface. The same instance can be passed to `Root.setStorage`
and the editor's `FileManager`.

```tsx
import {Root} from '@ticlo/core';
import {RemoteStorage} from '@ticlo/remote-storage';
import {FileManager} from '@ticlo/editor';

const storage = new RemoteStorage({baseURL: 'http://127.0.0.1:8010/file'});
await Root.instance.setStorage(storage);
await Root.instance.start({main: {flows: ['entry']}, local: {flows: ['**']}});

<FileManager storage={storage} project="main" />;
```

## Paths and scopes

Public project paths are `<project>/<relative-file-path>`, without `proj/`.
`storage.user` exposes the same file operations with paths relative to the
current user's directory. Paths reject traversal and backslashes. File APIs
return promises, accept `AbortSignal`, and support binary data as well as text.

| Scope | Remote | Static | Node |
| --- | --- | --- | --- |
| Project `main` | `proj/main/` | `proj/main/`, read-only | `<dir>/main/` |
| Project `local` | IndexedDB | IndexedDB | `<dir>/local/` |
| Current user | `usr/<authenticated-id>/` | `usr/guest/`, read-only | `<dir>/#root/` |
| `#global` | `usr/<authenticated-id>/#global.ticlo` | `usr/guest/#global.ticlo` | `<dir>/#root/#global.ticlo` |

Browser `local` is reserved: reads and writes never access a remote project with
that name, even when a local file is missing. It is always available, including
when empty, and cannot be deleted or moved as a project. The `ticlo-local-files`
IndexedDB database stores only this project: `entries` contains metadata and a
parent-directory index, while `contents` holds binary data. Empty directories
are real entries. Metadata and contents change in one transaction.

`#global` always uses `storage.user`. A missing global file produces an empty
global flow; there is no fallback to a project's global file. Project context
remains `<project>/#context.ticlo`.

## File operations

`getFile`, `getFileInfo`, `listFiles`, `uploadFile`, `createDirectory`,
`deleteFile`, `copyFile`, `moveFile`, and `renameFile` use the same interface
across backends. `listProjects`, `readProject`, `createProject`, `updateProject`,
and `deleteProject` manage projects. `_proj.json` is project metadata; runtime
namespace configuration remains in `ticlo.json`.

```ts
const read = await storage.user.getFile('#global.ticlo');
await storage.user.uploadFile('#global.ticlo', read.data, {revision: read.revision});
await storage.uploadFile('local/images/logo.png', imageBytes, {revision: null});
await storage.copyFile('main/assets', 'local/assets');
```

Reads return `{data: ArrayBuffer, revision?, contentType?}`. Writes return
`{revision?}`. `revision: null` creates only; a string requires the matching
revision. Omitting it permits an intentional overwrite. Runtime flow saves
retain their own loaded revision, independent of file preview reads, and report
conflicts without clearing unsaved changes. Flow mutations are ordered per key.

Copies include directories and empty folders. Cross-project copies use the same
interface, including between remote and local. Moves copy successfully before
removing the source; they are not an atomic transaction across backends. A failed
or conflicting operation must be handled by the caller; there is no automatic
retry or overwrite. `StorageError.code` distinguishes `not-found`, `conflict`,
`readonly`, `permission-denied`, `invalid-path`, and `io`.

`getCapabilities(path)` reports `write` and `persistent` for that scope. Static
project and guest files cannot be modified, even temporarily. Copy them to
`local` to edit. Static-to-local moves are rejected because the source cannot be
deleted. Missing timestamps and sizes are left undefined; static previews with
unknown sizes require an explicit load.

`read-storage` and `write-storage` use the calling flow's project under
`#storage/<encoded-key>.str`, through the same storage instance. Their listeners
are notified after successful changes. Detached/in-memory runtimes use memory
value storage. These listeners do not watch external filesystem or HTTP writers.

## Runtime file layout

| Relative project path | Purpose |
| --- | --- |
| `ticlo.json` | Namespace dependencies and service libraries |
| `#context.ticlo` | Namespace context |
| `folder/child.ticlo` | Ordinary flow `folder.child` |
| `#libs/tools.ticlo` | Library `tools` |
| `folder/flow.#.worker.ticlo` | On-demand worker subflow |
| `#storage/key.str` | String storage functions |

`#root` holds unqualified flows. Named projects map to `+project.flow` runtime
paths. `#libs`, `#deps`, and `#storage` are reserved root folder names; ordinary
folders named `libs`, `deps`, and `storage` are allowed. Catalog reads do not run
flows. See [runtime lifecycle](./runtime-lifecycle.md) for startup and dependencies.

## Server identity and local development

The Ticlo host installs `routeFileStorage` from `@ticlo/web-server/file-storage`
around the file-server routes. It adds `GET /file?op=user`, using the same
`authProvider` as file operations, and rejects access to another user's `usr`
directory. The client discovers its user ID through this endpoint; it contains
no admin default. There is no account or login system in this adapter.
Cross-origin hosts must allow conditional request headers and expose `ETag`;
the bundled server configures this for local development.

```ts
routeFileStorage(app, {
  rootDir: './files',
  authProvider: () => ({
    getUserId: () => 'admin',
    canRead: () => true,
    canWrite: () => true,
  }),
});
```

The bundled server uses `devUserAuth` (admin). Run `pnpm server` and
`pnpm vite-dev`, then open `file-server.html`, or use
`designer.html#host=http://127.0.0.1:8010/file&project=main&flow=entry`.
The combined server's runtime and file API now share `app/server/files/proj`;
Node accesses those files directly. Uploading a file does not automatically
reload an already running flow.

## Migration

The old `FileServerStorage`, `FileServerFlowStorage`, `StaticFlowStorage`,
`IndexDbStorage`, `IndexDbFlowStorage`, and Node `FileStorage`/`FileFlowStorage`
APIs are replaced. There is no legacy-layout fallback.

- Replace remote construction with `new RemoteStorage({baseURL})`; update servers
  to use `routeFileStorage` so current-user discovery is available.
- Pass the storage instance to `FileManager` using `storage`, and remove `proj/`
  from file API paths. Axios options/responses are replaced by file options and
  results. User files go through `storage.user`.
- Move browser globals from `proj/#root/#global.ticlo` to the appropriate
  `usr/<user>/#global.ticlo`; static deployments use `usr/guest/`.
- Pass the project collection directory to `new NodeStorage(dir)`. Move the old
  unqualified Node files into `#root/`, and rename `+main/` to `main/`. Existing
  file-server data can be used directly by passing its `files/proj` directory.
- The previous IndexedDB database is not deleted or automatically imported.
  Export old data before retiring it. When moving flows to project `local`,
  review namespace-qualified references; multiple old namespaces must not be
  silently flattened into one project.
- Browser demo flows now belong to `+local`; previous demo data remains in the
  old database. Static storage no longer accepts temporary memory-only writes.
