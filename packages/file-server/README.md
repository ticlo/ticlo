# Ticlo file storage

`@ticlo/file-server` provides Hono routes for project and user files.
`@ticlo/remote-storage` contains `TicloFileClient`, an Axios client for those routes.

```ts
import {Hono} from 'hono';
import {routeRemoteStorage} from '@ticlo/file-server';

const app = new Hono();
routeRemoteStorage(app, {rootDir: './files'});
```

Routes default to `/file`. Provide an `authProvider` for application access
control. The default provider permits reads and writes. CORS belongs to the
hosting application, including exposing `ETag` and allowing conditional
request headers when clients run on another origin.

```ts
import {TicloFileClient} from '@ticlo/remote-storage';

const client = new TicloFileClient({baseURL: 'http://localhost:8047/file'});
const project = await client.createProject('example');
await client.createDirectory(`proj/${project.id}/deps/shared`);
```

Project IDs cannot contain dots or path separators. `createProject(name, templateId?, config?)`
creates an empty project when the template is omitted; supplying a template
retains template-copy behavior. Browser projects live in `proj/<id>` and server
Node.js projects live in `serv/<id>`, each with `.proj` metadata. Project and Git
operations accept `scope=serv` to select server projects; the default is `proj`.
File operations use `serv/<id>/<path>` directly. User files live in `usr/<id>`.
Empty directories are preserved and
returned by the listing API. Dot-prefixed entries are omitted from file listings
but remain readable by path. Existing projects with dotted IDs are not listed or accessible.

Existing `_proj.json` files are renamed to `.proj` when the server opens the storage root.
If both names exist in one project, startup fails instead of overwriting either file.
Project archives import either `_proj.json` or `.proj` metadata and export only `.proj`.
Other dot-prefixed files, including `.gitignore`, `.gitlog`, and `.gitkeep`, are omitted from exports.

Read operations (`get`, `list`, `info`, `listProj`, `readProj`, `exportProj`,
`gitInfo`, `gitBranches`, `gitHistory`, `user`)
support GET. Mutating operations require POST; GET returns HTTP 405.
`user` and the client's `getCurrentUser` return the authenticated user's ID for accessing `usr/<id>` files.

## Project Git

Each `proj` or `serv` project can have its own Git repository. The Git command
implementation is shared with `NodeStorage` in the Node-only `@ticlo/node-git`
package. `gitInit` initializes the `main` branch,
creates `.gitignore` with `/.gitlog`, and stages the
existing files without committing. `gitInfo` returns `{initialized, branch?, hasUncommittedChanges?}`;
the change flag includes working files and pending `.gitlog` entries.
`gitBranches` lists local branches. `gitHistory` accepts an optional `branch`
and returns commits with hash, author, email, date, and full message.
`gitCommit` accepts `{message: string}`; the message may be empty.
`gitRestore` accepts a `proj/<id>/<file>` or `serv/<id>/<file>` path and restores a modified or deleted
tracked file from `HEAD`. The client exposes these operations as `initGit`,
`getGitInfo`, `getGitBranches`, `deleteGitBranch`, `getGitHistory`, `commitGit`, and `restoreGitFile`.
`gitReset` resets `main` to a history commit after creating a dated `backup/` branch.
Same-minute backups use `-2`, `-3`, and later suffixes.
It discards uncommitted changes. `createProj` accepts `template` and `commit`
to create an unversioned project from that commit's file snapshot.

File and project API writes four-column CSV rows to `.gitlog`: datetime, user,
change type, and file. The user field includes a real email when available;
generated `@ticlo.app` emails are omitted. Moved, renamed, and copied files
show source and destination in the file column. Repeated edits by the same user
to the same file within an hour replace the previous edit entry. A restore
replaces the preceding log entry for that file within an hour when both actions
have the same user. Deleting a newly created file within an hour removes its
create and edit entries when they all have the same user. `.proj` updates
are logged. Existing JSONL logs convert to CSV on the next edit or commit. Git
status in `list` and `info` is `added`, `modified`, or `deleted` when applicable;
deleted tracked entries remain visible in listings and info until committed.
Downloads of deleted entries still return 404. `.gitlog`, `.gitignore`, and
`.proj` can be read by path but cannot be changed through file APIs. Other
dot-prefixed files can be written, moved, and deleted;
`.git` is inaccessible through those APIs.

`gitCommit` stages all current project changes, including changes made outside
the file API, then commits them. Changes made outside the API have no `.gitlog`
entry. The commit message contains the user message once, followed by
`--- --- ---` and the CSV log rows when the log is nonempty. If every log entry
has the same user, that user becomes the Git author; otherwise the current user
does. `UserAuth` may provide `getUserName` and `getUserEmail`; without an email,
the server derives an address under `ticlo.app` from the user identity. After a
successful commit, `.gitlog` is cleared.
Git does not track empty directories.

Creating a project from a template copies its current working files, including
uncommitted changes and empty directories, without Git metadata or history.

## Conditional writes

Downloads and uploads return a strong SHA-256 content ETag. Upload and delete
operations accept `If-Match` and `If-None-Match`; failed preconditions return
HTTP 412. For a new file, send `If-None-Match: *`. For an existing file, send
the ETag from its last read as `If-Match`:

```ts
const path = `proj/${project.id}/example.txt`;
const created = await client.uploadFileResponse(path, 'first', {}, {
  headers: {'If-None-Match': '*'},
});
await client.uploadFileResponse(path, 'second', {}, {
  headers: {'If-Match': created.headers.etag},
});
```

`uploadFileResponse` returns the full Axios response, including headers.
`uploadFile` retains its byte-count string return value. Uploads write to a
temporary sibling and atomically rename it into place. API mutations sharing
a storage root serialize within a single server process, so concurrent
conditional writers cannot both replace the same revision. Use one server
process per storage root; edits by other processes are outside this lock.
Requests without preconditions retain unconditional-write behavior.

## Development

Run `pnpm install`, `pnpm test`, and `pnpm build-package` from the Ticlo root.
`pnpm dev` starts the local server and browser app. The file server is a workspace
package and requires Hono in the host application.
Project Git operations require the `git` executable on the server host.
