# Static storage

`StaticStorage` from `@ticlo/remote-storage` implements the same file and flow
interfaces as remote and Node storage. Its base URL contains `proj/` and `usr/`.

```ts
import {StaticStorage} from '@ticlo/remote-storage';

const storage = new StaticStorage('https://example.com/files');
await Root.instance.setStorage(storage);
await Root.instance.start({main: {flows: ['entry']}, local: {flows: ['**']}});
```

Static project files and `usr/guest/` are read-only. `#global` loads from
`usr/guest/#global.ticlo`. Only browser project `local` is writable and persistent,
using IndexedDB. Copy a static file into local to edit it; writes and moves that
would modify static sources are rejected. There is no temporary write overlay.

## Directory indexes

Each `.list.json` is a JSON array of filenames; directory entries end in `/`.
For example, `proj/main/.list.json`:

```json
["ticlo.json", "entry.ticlo", "folder/", "#context.ticlo", "#libs/", "#storage/"]
```

`folder/.list.json` can contain `["child.ticlo"]`; empty folders use `[]`.
Indexes use literal `#`; the storage encodes URL components. Project listing uses
`proj/.list.json`. Indexes omit file-server metadata `_proj.json`, which remains
readable directly. Optional file timestamps and sizes are unknown in these
indexes. Missing or malformed indexes reject catalog reads.

## Local development

Run `pnpm static-server` and `pnpm vite-dev`. Open `static-server.html`, then
open the editor. The server serves `app/server/files`, sharing project data with
`pnpm server`, and rebuilds indexes at startup. Restart after adding/removing
files. Provide user globals under `usr/guest/` as needed.

Designer and Playground without a remote host use bundled static defaults plus
the IndexedDB local project. See [file storage](./remote-storage.md) for API
contracts, scope routing, and migration.
