# Remote storage

`@ticlo/remote-storage` exports `FileServerStorage` for strings and
`FileServerFlowStorage` for flows, using `TicloFileClient` from `@ticlo/file-client`.

```ts
import {Root} from '@ticlo/core';
import {FileServerFlowStorage, TicloFileClient} from '@ticlo/remote-storage';

const client = new TicloFileClient({baseURL: 'http://127.0.0.1:8010/file'});
await Root.instance.setStorage(new FileServerFlowStorage(client));
await Root.instance.start({main: {flows: ['example']}});
```

## Project layout

Remote and [static storage](./static-storage.md) share this layout. Each project
is a namespace; `#root` holds unqualified flows. Global settings always load from
`proj/#root/#global.ticlo`, even when starting a named project.

| Path under `proj/` | Purpose / runtime path |
| --- | --- |
| `#root/#global.ticlo` | Global settings; missing file means an empty global flow |
| `#root/example.ticlo` | `example` |
| `main/_proj.json` | File-server project metadata; runtime storage never reads/writes it |
| `main/ticlo.json` | Namespace dependencies and Service Libraries |
| `main/folder/child.ticlo` | `+main.folder.child` |
| `main/#libs/tools.ticlo` | Library for `+main:tools:worker`, separate from ordinary flows |
| `main/folder/flow.#.worker.ticlo` | `+main.folder.flow.#.worker`; subflows load on demand |
| `main/#storage/key.str` | Generic string storage |

For `ticlo.json`, startup selection, and library loading, see
[runtime lifecycle](./runtime-lifecycle.md). Project IDs cannot contain dots.
`#libs`, `#deps`, and `#storage` are reserved root folder names, although dependencies
use metadata, not a directory. User folders named `libs`, `deps`, and `storage`
are allowed. These conventions belong to flow adapters; the file server handles
generic directories and its client encodes `#` in HTTP paths.

Remote initialization lists folders recursively, including empty folders, through
the file-server API; it needs no `.list.json`. Folder creation persists immediately:
await `folder.pendingCreate` in direct runtime calls (the editor already does).
Deletion removes the directory and contents before removing the runtime node.
Flows and folders cannot share a runtime name.

## Writes and conflicts

Saves/deletions return promises and serialize per file. Reads capture ETags;
updates/deletions send `If-Match`. A first save without a read sends
`If-None-Match: *`, allowing creation only. HTTP 412 means a stale revision;
reload before retrying. Failed saves and edits made during a pending save remain
unsaved. Closing the host page does not delete files.

For strings, use `new FileServerStorage(client, 'proj/main/#storage', '.str')`.
Namespace selection for the generic storage function provider is deferred;
browser demos install only flow storage.

## Storage format change

There is no legacy-layout fallback. Migrate existing files:

1. Keep `_proj.json`; rename special project `_root` to `#root` and update its
   metadata ID.
2. Rename internal `libs`/`storage` to `#libs`/`#storage`. Move dependency names
   from `deps`/`#deps` folders into `ticlo.json`'s `dependencies` array.
3. Move dotted flow names into folders: `folder.child.ticlo` → `folder/child.ticlo`.
   Preserve `.#...` worker suffixes on filenames.
4. Regenerate `.list.json` indexes for static hosting.

Node `FileFlowStorage` uses real folders under its existing namespace path:
`<dir>/+main/folder/child.ticlo`, with libraries in `<dir>/+main/#libs/`.
IndexedDB keeps dotted keys and reconstructs folders; empty folders have no key.

## Local development

Use the published `@ticlo/file-server` and `@ticlo/file-client` packages:

```sh
pnpm install
pnpm server
# In another terminal:
pnpm vite-dev
```

Open `http://localhost:3003/file-server.html`, then **open editor**. Keep the host
page open: it runs flows and connects `editor.html` through window messages.
Select flows with `?project=main&flow=entry&flow=jobs.**`, or another file endpoint
with `?host=https://example.com/file&project=main`.

The playground uses the same options in its hash:

```text
http://localhost:3003/playground.html#host=http://127.0.0.1:8010/file&project=main&flow=entry&flow=jobs.**
```

- `project` defaults to `#root`; encode it as `%23root` in URLs.
- Repeat `flow` for [startup patterns](./runtime-lifecycle.md). With neither
  `project` nor `flow`, all ordinary `#root` flows load. An explicit project with
  no `flow` starts only Service Libraries; `flow=**` selects all its ordinary flows.
- A nonempty playground `host` selects remote storage without demo data and
  opens the first loaded flow. Without `host`, it uses IndexedDB/local demo data.
  Changing the hash reloads the page. Append `&strictMode` for either storage.

`pnpm server`, `pnpm ticlo-server`, and `pnpm file-server` start the same combined
server on `127.0.0.1:8010`:

| Endpoint | Purpose |
| --- | --- |
| `WS /ticlo` | Editor connection to server-side flows |
| `POST /ticlo` | Runtime commands |
| `GET/POST /file?op=…` | Project/file management |
| `GET /file/*` | File downloads |
| `/api/*` | Flow-defined HTTP endpoints |
| `GET /health` | `{"status":"ok"}` |
| `GET /` | Endpoint overview |

Files live in ignored `app/server/files`. The server creates `#root` and its
metadata only when absent; it generates no flow files. The server runtime uses
`app/server/flows`: uploading through `/file` does not load/reload that runtime.
The browser host has its own runtime using `/file`.

File-route CORS allows local dev origins, accepts `If-Match`/`If-None-Match`, and
exposes `ETag`. Runtime CORS is scoped to `/ticlo` and `/api` to preserve those
rules. The host app owns CORS; `@ticlo/file-server` does not add it.
