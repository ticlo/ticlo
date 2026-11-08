# File server

`@ticlo/file-server` provides Hono routes. The host owns authentication and CORS.
`@ticlo/web-server` adds authenticated user discovery through `routeFileStorage`.

```ts
import {Hono} from 'hono';
import {routeRemoteStorage} from '@ticlo/file-server';

const app = new Hono();
routeRemoteStorage(app, {rootDir: './files', authProvider});
```

Routes default to `/file`. The default auth provider permits reads and writes;
applications supply their own access policy. Browser project files live in
`proj/<id>`, server projects in `serv/<id>`, and user files in `usr/<id>`.
Project and Git operations default to `scope=proj`; use `scope=serv` for server
projects. Raw file paths include their scope. Public storage adapters hide that
prefix; see [file storage](remote-storage.md).

Project IDs cannot contain dots or path separators. `.proj` stores project
metadata, independent of runtime `ticlo.json`. Startup migrates `_proj.json`
without overwriting existing metadata. Listings omit dotfiles; archives import
either metadata name and export only `.proj` among dotfiles. `.git` is inaccessible
through file APIs; `.proj`, `.gitignore`, and `.gitlog` can be read but not mutated
through ordinary file operations.

Reads use GET and mutations require POST. `getCurrentUser()` discovers the user
for `usr/<id>` access; the host rejects access to another user's files. The
[HTTP client](../packages/remote-storage/TicloFileClient.ts) is the source for
operation arguments and return types.

## Revisions and concurrency

Downloads and uploads return strong content ETags. `If-Match` requires the last
read revision; `If-None-Match: *` creates only. Failed preconditions return 412.
Requests without preconditions overwrite intentionally. Cross-origin hosts allow
these headers and expose `ETag`.

Uploads atomically replace files through temporary siblings. Mutations sharing a
storage root serialize within one process; run one server process per root.
External filesystem writers do not participate in that lock.

## Project Git

The Node-only `@ticlo/node-git` package implements Git for both the server and
`NodeStorage`. Git operations require project write permission. `initGit` creates
`main` and stages existing files without a commit. `getGitInfo` reports branch and
pending changes. `getGitHistory(project, {branch})` reads a branch or the current
branch; `getGitBranches` lists local branches. `deleteGitBranch` protects `main`
and the checked-out branch.

`commitGit` stages all working changes. `restoreGitFile` restores a tracked file
from HEAD. Deleted tracked files remain in listings until committed. Reset first
preserves HEAD on a dated `backup/` branch, then discards working changes and
resets `main` to the selected commit. A project created from a history commit has
that file snapshot without Git metadata. A template copy includes working files
and empty directories, also without Git history.

API writes append CSV `.gitlog` records with datetime, user, change type, and file.
Related edits may be coalesced. External filesystem writes have no API
log but are still included in commits. Commit messages contain the user comment,
then `--- --- ---` and log records when present. A single recorded user becomes
the author; mixed-user changes use the current user. Successful commits clear
the log. Old JSONL logs convert on edit or commit.
