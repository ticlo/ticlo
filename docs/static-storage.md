# Static storage

`StaticStorage` reads string values from HTTP files. `StaticFlowStorage` uses the
same project layout as [remote storage](./remote-storage.md), with
`.list.json` files replacing the directory listing API:

```text
proj/
  _root/
    .list.json
    _proj.json
    #global.ticlo
    example.ticlo
  main/
    .list.json
    _proj.json
    example.ticlo
    folder.child.ticlo
    example.#.worker.ticlo
    libs/
      .list.json
      tools.ticlo
    deps/
      .list.json
      shared/
    storage/
      .list.json
      key.str
  shared/
    .list.json
    _proj.json
    example.ticlo
```

Each `.list.json` contains a JSON array of the filenames in that folder. Directory
names end with `/`. For example, `proj/main/.list.json` contains:

```json
["example.ticlo", "folder.child.ticlo", "example.#.worker.ticlo", "libs/", "deps/", "storage/"]
```

Its `deps/.list.json` contains `["shared/"]`. Empty folders mark dependencies;
their contents are not read. The dependency's flows come from `proj/shared`.
Indexes are required for `_root`, each loaded project, and every listed `deps/`
folder. A project without `deps/` in its index has no dependencies.

```ts
import {Root} from '@ticlo/core';
import {StaticFlowStorage, StaticStorage} from '@ticlo/html';

await Root.instance.setStorage(new StaticFlowStorage('https://example.com/files', 'main'));
const values = new StaticStorage('https://example.com/files/proj/main/storage', '.str');
```

The initial project defaults to `_root`. Global data always loads first from
`proj/_root/#global.ticlo`. Opening `main` loads its flows under `+main` and
recursively visits dependencies before loading the referring project's flows.
Already visited projects are skipped to handle cycles and repeated dependencies.
Ordinary `_root` flows load only when it
is selected or included as a dependency. Unrelated projects are not loaded.

Libraries such as `+main:tools:worker` load on demand from
`proj/main/libs/tools.ticlo`, separate from ordinary flows of the same name.
Subflows also load on demand. Invalid flow filenames and dependency names are
ignored; project IDs cannot contain dots. `_proj.json` can remain in the shared
file-server tree, but static storage does not require its metadata.

Saves and deletions stay in memory for each storage instance. Reloading the
page restores the remote files. The HTTP host must allow cross-origin reads
when the page and files have different origins. Generic storage paths are
explicit; the demo installs only flow storage, like the file-server demo.

To try it locally, run these commands in separate terminals:

```sh
pnpm static-server
pnpm vite-dev
```

Open `http://localhost:3003/static-server.html`, then click **open editor**. The
page hosts the flows, and `editor.html` connects to it through window messages.
Keep the host page open while editing.

The test server serves `app/server/files` at `http://127.0.0.1:8011`, sharing the
same files as `pnpm file-server`. It seeds `_root` and an example flow without
overwriting existing data, then writes `.list.json` files recursively at
startup. Restart it after adding or removing files through the file server or
on disk. Old `app/server/flows` files must be moved into `files/proj/_root`.

Add `?project=main` to select a project, or
`?host=https://example.com/files&project=main` to use another static host. The
host URL should contain the `proj` folder, rather than point inside a project.
