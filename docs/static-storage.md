# Static storage

`StaticStorage` reads string values from HTTP files. `StaticFlowStorage` uses the
same project layout as [remote storage](./remote-storage.md), with
`.list.json` files replacing the directory listing API:

```text
proj/
  #root/
    .list.json
    ticlo.json
    #global.ticlo
    example.ticlo
  main/
    .list.json
    ticlo.json
    example.ticlo
    folder/
      .list.json
      child.ticlo
    example.#.worker.ticlo
    #libs/
      .list.json
      tools.ticlo
    #storage/
      .list.json
      key.str
  shared/
    .list.json
    ticlo.json
    example.ticlo
```

Each `.list.json` contains a JSON array of the filenames in that folder. Directory
names end with `/`. For example, `proj/main/.list.json` contains:

```json
["ticlo.json", "example.ticlo", "folder/", "example.#.worker.ticlo", "#libs/", "#storage/"]
```

`ticlo.json` contains `dependencies` and `serviceLibraries`, using the
same namespace configuration as RemoteStorage. Include it in the project's index
when present. The file server's `_proj.json` is excluded from the generated index
and is not read by runtime storage.
Indexes are required for `#root`, enabled projects, and user folders visited by
startup flow selection. There is no dependency directory or dependency index.

```ts
import {Root} from '@ticlo/core';
import {StaticFlowStorage, StaticStorage} from '@ticlo/html';

await Root.instance.setStorage(new StaticFlowStorage('https://example.com/files'));
await Root.instance.start({main: {flows: ['example']}});
const values = new StaticStorage('https://example.com/files/proj/main/%23storage', '.str');
```

Use `%23` for `#` in HTTP URLs, including `?project=%23root`. Directory names
and `.list.json` entries contain literal `#` characters; the flow adapter encodes
request paths automatically.

`start()` and `start({})` load all ordinary flows in `#root`, including nested
folders. Global settings always load from `proj/#root/#global.ticlo`. Dependencies
activate recursively, starting their Service Libraries; their ordinary flows
require explicit selection. Other libraries load when called from active
namespaces. See [runtime lifecycle](./runtime-lifecycle.md).

Libraries such as `+main:tools:worker` load from `proj/main/#libs/tools.ticlo`,
separate from ordinary flows of the same name. Invalid ordinary flow filenames
are ignored; invalid namespace metadata rejects startup.

User folders use real directories and load recursively. For example,
`folder/.list.json` contains `["child.ticlo"]`; an empty folder's index contains
`[]`. `#libs` and `#storage` are reserved at project roots. Ordinary
folders named `libs`, `deps`, and `storage` are allowed.

Folder creation, saves, and recursive deletions stay in memory for each storage
instance. Persistent lifecycle changes (`persist: true` or service metadata saves)
are rejected; update deployed files instead. Reloading the page restores the remote files. The HTTP host must allow cross-origin reads
when the page and files have different origins. Generic storage paths are
explicit; the demo installs only flow storage, like the file-server demo.

Existing files must use the [new directory layout](./remote-storage.md#storage-format-change);
legacy dotted flow filenames and internal directory names are not supported.

To try it locally, run these commands in separate terminals:

```sh
pnpm static-server
pnpm vite-dev
```

Open `http://localhost:3003/static-server.html`, then click **open editor**. The
page hosts the flows, and `editor.html` connects to it through window messages.
Keep the host page open while editing.

The test server serves `app/server/files` at `http://127.0.0.1:8011`, sharing the
same files as the combined server's `/file` endpoint (`pnpm server`). It creates `#root`
only if absent, without generating any flows, then writes `.list.json` files recursively at
startup. Restart it after adding or removing files through the file server or
on disk. To serve flows from `app/server/flows` statically, copy them into
`app/server/files/proj/#root`; the server runtime still uses its own flow directory.

Add `?project=main&flow=entry&flow=jobs.**` to select initial flows, or
`?host=https://example.com/files&project=main` to use another static host. The
host URL should contain the `proj` folder, rather than point inside a project.
With neither `project` nor `flow`, all ordinary flows in `#root` load by default.
