# Static storage

`StaticStorage` from `@ticlo/remote-storage` implements the same file and flow
interfaces as remote and Node storage. Its base URL contains `proj/` and `usr/`.

```ts
import {Root} from '@ticlo/core';
import {StaticStorage} from '@ticlo/remote-storage';

const storage = new StaticStorage('https://example.com/files');
await Root.instance.setStorage(storage);
await Root.instance.start({main: {flows: ['entry']}, BrowserLocal: {flows: ['**']}});
```

Static project files and `usr/guest/` are read-only. `#global` loads from
`usr/guest/#global.ticlo`. `BrowserLocal` is writable and persistent in IndexedDB.
Copy a static file into `BrowserLocal` to edit it.

## Directory indexes

Each `.list.json` is a JSON array of filenames; directory entries end in `/`.
For example, `proj/main/.list.json`:

```json
["ticlo.json", "entry.ticlo", "folder/", "#context.ticlo", "#modules/", "#storage/"]
```

`folder/.list.json` can contain `["child.ticlo"]`; empty folders use `[]`.
Indexes use literal `#`; the storage encodes URL components. Project listing uses
`proj/.list.json`. Indexes omit file-server metadata `.proj`, which remains
readable directly. Optional file timestamps and sizes are unknown in these
indexes. Missing or malformed indexes reject catalog reads.

## Local development

Run `pnpm static-server` and `pnpm vite-dev`. Open `static-server.html`, then
open the editor. The server serves `app/server/files`, sharing project data with
`pnpm server`, and rebuilds indexes at startup. Restart after adding/removing
files. Provide user globals under `usr/guest/` as needed.

Designer and Dataflow Editor without a remote host use bundled static defaults plus
the IndexedDB local project. See [file storage](remote-storage.md) for API
contracts, scope routing, and revisions.
