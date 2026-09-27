# Remote storage

The `packages/remote-storage` workspace package is named `@ticlo/remote-storage`.
It exports `FileServerStorage` for string values and `FileServerFlowStorage`
for flows, using `TicloFileClient` from `@ticlo/file-client`.

```ts
import {Root} from '@ticlo/core';
import {FileServerFlowStorage, TicloFileClient} from '@ticlo/remote-storage';

const client = new TicloFileClient({baseURL: 'http://127.0.0.1:8012/file'});
await Root.instance.setStorage(new FileServerFlowStorage(client));
await Root.instance.start({main: {flows: ['example']}});
```

Each file-server project represents a namespace. `#root` contains flows without
a namespace and is the default initial project. Global data always loads from
`proj/#root/#global.ticlo`, including when the initial project is named.

```text
files/proj/
  #root/
    _proj.json
    ticlo.json
    #global.ticlo
    example.ticlo
  main/
    _proj.json
    ticlo.json
    example.ticlo
    folder/
      child.ticlo
    #libs/
      tools.ticlo
  shared/
    _proj.json
    ticlo.json
    example.ticlo
  common/
    _proj.json
    ticlo.json
```

Namespace dependencies and Service Libraries are declared in a separate
`ticlo.json`, for example:

```json
{"dependencies":["shared"],"serviceLibraries":["tools"]}
```

Startup recursively enables dependencies and their Service Libraries. Ordinary
flows load only when explicitly selected by `start()` or `loadFlow()`. Missing
dependencies fail startup; project IDs cannot contain dots. See
[runtime lifecycle](./runtime-lifecycle.md) for API and persistence rules.

Libraries load on demand from `#libs/<library>.ticlo`; `+main:tools:worker` uses
`proj/main/#libs/tools.ticlo`. This keeps libraries separate from ordinary flows with
the same name. Subflows also load on demand. Directory contents come from the
file-server listing API, so `.list.json` is unnecessary for this storage.

User folders map to physical directories: `+main.folder.child` is stored at
`proj/main/folder/child.ticlo`. Initialization reads folders recursively, including
empty folders. Folder creation persists immediately; direct runtime callers can
await the returned folder's `pendingCreate`. The editor waits for creation to
finish. Deleting a folder removes its directory and contents before removing it
from the runtime tree. A flow and folder cannot share a runtime name.

`#libs` and `#storage` are reserved directory names at each project root.
User folders named `libs`, `deps`, and `storage` are allowed. These conventions
belong to the flow storage adapters; the file server provides generic directories.
`#root` is the special project for unqualified flows. File server 0.1.0 keeps its
project management metadata in `_proj.json`; runtime storage does not read or
write that file. `ticlo.json` contains only namespace configuration and is readable
with the other project files. The file client encodes `#` in HTTP paths.
Worker subflow suffixes stay in filenames: `+main.folder.flow.#.worker` maps to
`proj/main/folder/flow.#.worker.ticlo` and loads only on demand.

File saves and deletions return promises and serialize per file. Reads capture the
server's ETag; updates and deletions send `If-Match`. A first save without a
prior read uses `If-None-Match: *`, so it can only create a missing file. A stale
revision fails with HTTP 412. Reload the current file before retrying; failed
saves do not clear the flow's unsaved state. Edits made during a pending save
also remain unsaved. Closing the host page does not delete saved flows.

For string values, construct `new FileServerStorage(client, 'proj/main/#storage',
'.str')`. Namespace selection for the generic storage function provider is
deferred; the demo installs only flow storage.

## Storage format change

There is no fallback to the old layout. Before using an existing project:

1. Keep project metadata named `_proj.json`. Rename the special project `_root`
   to `#root` and update its metadata id.
2. Rename internal `libs` and `storage` to `#libs` and `#storage`. Move dependency
   names from old `deps`/`#deps` folders into `dependencies` in `ticlo.json`.
3. Move dotted flow filenames into directories: `folder.child.ticlo` becomes
   `folder/child.ticlo`. Keep any `.#...` worker suffix on the filename.
4. Regenerate `.list.json` indexes if the same files are served by static storage.

Node's `FileFlowStorage` also uses real folders, retaining its existing namespace
location: `+main/folder/child.ticlo` under its configured directory. Namespace
libraries now live in `+main/#libs/`. IndexedDB continues to use dotted keys and
reconstructs folders from saved flows; empty folders have no separate key.

## Local development

Ticlo uses the published npm packages `@ticlo/file-server` and
`@ticlo/file-client`. Run these commands in the Ticlo repository:

```sh
pnpm install
pnpm file-server
# In another terminal:
pnpm vite-dev
```

Open `http://localhost:3003/file-server.html` and click **open editor**. The
host page runs selected flows and connects `editor.html` through window messages.
Keep it open while editing. Add `?project=main&flow=entry&flow=jobs.**` to select a project and initial flows, or
`?host=https://example.com/file&project=main` to select another file host.

The dev server listens on `127.0.0.1:8012` and stores files in the ignored
`app/server/files` folder. It seeds `#root` and an example flow without
overwriting existing data. Its CORS middleware allows local development
origins and exposes ETags. CORS configuration belongs to the hosting app;
`@ticlo/file-server` does not add it.
