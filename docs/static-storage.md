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

Vite serves `app/static-storage` at `/storage` and generates directory indexes
on request. The Pages build publishes the same files and indexes. Designer and
Dataflow Editor use this storage by default and open the editable `BrowserLocal`
demo. Choose `examples` from the Library menu or open either app with
`?project=examples` to browse chart and layout Flows.

Run `pnpm static-server` and open `static-server.html` in Vite to use the
standalone server on port 8011. It serves `proj/` and `usr/` from
`app/server/files` and rebuilds indexes on startup. See
[file storage](remote-storage.md) for scope routing and revisions.
