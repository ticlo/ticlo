# Static storage

`@ticlo/html` exports `StaticStorage` for HTTP string values and `StaticFlowStorage`
for flows. Both use the [remote project layout](./remote-storage.md#project-layout),
with `.list.json` indexes instead of a directory listing API.

```ts
import {Root} from '@ticlo/core';
import {StaticFlowStorage, StaticStorage} from '@ticlo/html';

await Root.instance.setStorage(new StaticFlowStorage('https://example.com/files'));
await Root.instance.start({main: {flows: ['example']}});
const values = new StaticStorage('https://example.com/files/proj/main/%23storage', '.str');
```

The base URL contains `proj/`. Use `%23` for `#` in explicit URLs; the flow adapter
encodes request paths automatically. See [runtime lifecycle](./runtime-lifecycle.md)
for startup, metadata, and library loading.

## Directory indexes

Each `.list.json` is a JSON array of filenames; directory entries end in `/`.
For example, `proj/main/.list.json`:

```json
["ticlo.json", "example.ticlo", "folder/", "example.#.worker.ticlo", "#libs/", "#storage/"]
```

`folder/.list.json` can contain `["child.ticlo"]`; empty folders use `[]`.
Names contain literal `#`. Include `ticlo.json` when present; generated indexes
exclude file-server metadata `_proj.json`.

Indexes are required for `#root`, enabled projects, and user folders visited by
startup selection. Libraries have their own `#libs/.list.json`. There is no
dependency directory/index. Invalid ordinary flow names are ignored; invalid
namespace metadata rejects startup. Legacy layouts require
[migration](./remote-storage.md#storage-format-change).

## Persistence

Folder creation, saves, and recursive deletions stay in memory per storage
instance; page reload restores deployed files. Persistent lifecycle changes
(`persist: true`, service metadata saves) are rejected. Deploy edited files to
change saved configuration. Cross-origin hosts must allow reads through CORS.
Generic string paths are explicit; the browser demo installs only flow storage.

## Local development

Run in separate terminals:

```sh
pnpm static-server
pnpm vite-dev
```

Open `http://localhost:3003/static-server.html`, then **open editor**. Keep the
host page open: it runs flows and connects `editor.html` through window messages.
Add `?project=main&flow=entry&flow=jobs.**` to select initial flows, or
`?host=https://example.com/files&project=main` for another host. Encode `#root`
as `%23root`; with neither `project` nor `flow`, all ordinary `#root` flows load.

The server serves `app/server/files` at `http://127.0.0.1:8011`, sharing files with
`pnpm server`'s `/file` endpoint. It creates `#root` only if absent, generates no
flows, and rebuilds indexes recursively at startup. Restart after adding/removing
files. To serve `app/server/flows` statically, copy them into
`app/server/files/proj/#root`; the server runtime still uses its own directory.
