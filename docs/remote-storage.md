# Remote storage

The `packages/remote-storage` workspace package is named `@ticlo/remote-storage`.
It exports `FileServerStorage` for string values and `FileServerFlowStorage`
for flows, using `TicloFileClient` from `@ticlo/file-client`.

```ts
import {Root} from '@ticlo/core';
import {FileServerFlowStorage, TicloFileClient} from '@ticlo/remote-storage';

const client = new TicloFileClient({baseURL: 'http://127.0.0.1:8012/file'});
await Root.instance.setStorage(new FileServerFlowStorage(client, 'main'));
```

Each file-server project represents a namespace. `_root` contains flows without
a namespace and is the default initial project. Global data always loads from
`proj/_root/#global.ticlo`, including when the initial project is named.

```text
files/proj/
  _root/
    _proj.json
    #global.ticlo
    example.ticlo
  main/
    _proj.json
    example.ticlo
    folder.child.ticlo
    libs/
      tools.ticlo
    deps/
      shared/
  shared/
    _proj.json
    example.ticlo
    deps/
      common/
  common/
    _proj.json
```

Opening `main` loads ordinary flows from `main`, `shared`, and `common`, as
`+main.example`, `+shared.example`, and so on. Empty folders under `deps` name
project dependencies. Initialization recursively visits dependencies before
loading the referring project's flows, skipping already visited projects to
handle cycles and repeated dependencies. Unrelated projects stay
unloaded. Missing or inaccessible dependency projects fail initialization.
Project IDs cannot contain dots. Invalid flow filenames are ignored.

Libraries load on demand from `libs/<library>.ticlo`; `+main:tools:worker` uses
`proj/main/libs/tools.ticlo`. This keeps libraries separate from ordinary flows with
the same name. Subflows also load on demand. Directory contents come from the
file-server listing API, so `.list.json` is unnecessary for this storage.

Saves and deletions return promises and serialize per file. Reads capture the
server's ETag; updates and deletions send `If-Match`. A first save without a
prior read uses `If-None-Match: *`, so it can only create a missing file. A stale
revision fails with HTTP 412. Reload the current file before retrying; failed
saves do not clear the flow's unsaved state. Edits made during a pending save
also remain unsaved. Closing the host page does not delete saved flows.

For string values, construct `new FileServerStorage(client, 'proj/main/storage',
'.str')`. Namespace selection for the generic storage function provider is
deferred; the demo installs only flow storage.

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
host page runs the flows and connects `editor.html` through window messages.
Keep it open while editing. Add `?project=main` to select a project, or
`?host=https://example.com/file&project=main` to select another file host.

The dev server listens on `127.0.0.1:8012` and stores files in the ignored
`app/server/files` folder. It seeds `_root` and an example flow without
overwriting existing data. Its CORS middleware allows local development
origins and exposes ETags. CORS configuration belongs to the hosting app;
`@ticlo/file-server` does not add it.
