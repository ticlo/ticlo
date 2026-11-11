# SQL clients

Core registers `sql:query` and exports the `SqlClient`, `SqlParams`, `SqlResult`,
and `SqlTable` types. Database connectors expose runtime services implementing
`SqlClient`. Connection functions have the `sql-client` tag;
the `client` service input of `sql:query` uses that tag to find compatible blocks.
See [service bindings](editor.md#property-editors) for global Block naming and
service input/output descriptors.

## Query contract

`sql:query` accepts a `client`, a non-empty `sql` string, and optional `params`
(an array or an object). SQL dialects and parameter placeholders remain specific
to each database adapter. Parameters are bound by the driver, not interpolated
into the SQL string.

The function defaults to `onCall`. Editing SQL or parameters does not execute a
statement in this mode. Trigger `#call` to execute; normal Block `#wait` and
`#emit` events report completion or errors. Canceling or replacing a call
discards its eventual output; it does not roll back database writes.

`SqlResult.table`, when present, contains `columns: SqlColumn[]` and
`rows: unknown[][]`. Column names are unique; `sourceName` can preserve a driver's
original name, and `databaseType` can preserve its type description. A result set
with no rows retains its columns and an empty `rows` array. Statements without a
result set leave `table` absent.

The Table is published as readonly `#output`. Optional `affectedRows` and
`insertId` are separate outputs; adapters may omit unavailable metadata. Large
integer identifiers use strings to preserve precision. Each call clears previous
outputs, including when it fails. The initial contract supports one statement
and at most one result set per call.

## Transactions

`sql:transaction` accepts a `client` and a non-empty `statements` array of
`{sql, params?}` rows. Trigger `#call` to execute the rows in order on the same
database connection. Each row contains a single query or data modification and
starts with its SQL keyword. The client commits on success and rolls back on
failure. The outputs describe the final statement after a successful commit.
Cancellation follows the same rules as `sql:query`.

## SQLite

Import `@ticlo/sqlite` in Node.js to register `sqlite:client`. It is not a browser
module. Applications must explicitly import connectors; the development server
already imports this one.

Configure `filePath` with a database path or `:memory:`. Relative paths resolve
from the server process's working directory. Writable connections create a
missing database file but do not create parent directories. `readOnly` defaults
to false; `busyTimeout` defaults to 5000 milliseconds; `foreignKeys` defaults to
true. Node.js 24.11 or newer is required.

The client opens on load, reopens when its inputs change, and closes when its
Block is destroyed. One Worker owns each connection, executes requests in order,
and keeps synchronous SQLite operations off the runtime thread. Closing rejects
new requests and lets submitted requests finish. Reopening `:memory:` creates a
new empty database. Runtime services are not serialized into saved flows.

Use `?` placeholders with an array, or named placeholders such as `$id` with an
object such as `{id: 42}`. SQLite parameters support null, strings, numbers,
bigints, booleans, and binary values. Booleans are bound as 0 or 1. Result integers
within the safe JavaScript range become numbers; larger integers become decimal
strings. Binary results remain `Uint8Array` values. Repeated result column names
receive unique suffixes while preserving their original names in `sourceName`.

`SELECT` and statements such as `INSERT ... RETURNING` produce Tables. Multiple
statements in one query are rejected before execution. Modification counts
exclude trigger side effects, following SQLite's `changes()` semantics. An insert
ID is reported when the connection's last insert row ID changes during the call;
it may be absent when SQLite reuses the same ID. Schema-only statements report
zero affected rows rather than reusing a preceding write's metadata.

## PostgreSQL

Import `@ticlo/postgres` in Node.js to register `postgres:client`. The development
server imports it. Enter a URL such as `postgresql://app@db.example:5432/mydb` in
`connectionString` and set the database password through the Block's
[`#secret` configuration](runtime-lifecycle.md#block-secrets). Move passwords
from existing URLs to `#secret` before saving the Flow. The Block opens a pool
on load and replaces it when its configuration changes. `maxConnections` defaults
to 10, `connectionTimeout` to 5000 ms, and `statementTimeout` to 30000 ms.
Set a timeout to 0 to disable it.

To supply the password from the host environment, bind a
[`node:env` helper](runtime-lifecycle.md#environment-variables) to `#secret`.

Use positional placeholders such as `$1` with an array. A statement with
`RETURNING` includes a table, and write statements report the driver's affected
row count. Use `RETURNING id` to retrieve generated IDs. `bigint`, `numeric`,
and calendar and timestamp values are returned as text to preserve precision.
`bytea` values are returned as `Uint8Array`. Use `sql:transaction` for a group
of statements that must share a transaction.

Set `TICLO_TEST_POSTGRES_URL` to a disposable database URL and run
`pnpm test connectors/postgres` to exercise the connector against PostgreSQL.
The test account needs permission to create and drop test schemas.

## Client management

`SqlClient` provides `query(sql, params?)`, `listEntities()`,
`getColumns(entity)`, and optionally `transaction(statements)`. Entities are
tables or views, identified by a structured `{catalog?, schema?, name}`
reference. Identifier parts remain separate even when names contain dots or
quotes. Column metadata includes a name and, when known, database type,
nullability, primary key membership, and a default expression.
SQLite uses its attached database names as schemas and reports declared
`NOT NULL` constraints for nullability, including columns of views and generated
columns.

Adapters reuse core's `sqlClientCommands` descriptor and `sqlClientApi` as their
function API. These expose `listEntities`, `getColumns` (`{catalog?, schema?, name}`), and `query`
(`{sql, params?}`) commands against the current `#output` service, including
code-defined globals. Named results are `{entities}` for `listEntities`, `{columns}`
for `getColumns`, and `{table?, affectedRows?, insertId?}` for `query`, inside the
connection's `{result}` response wrapper. Commands do not paginate or truncate results. Metadata commands
are readonly. Query commands reject execution on a readonly server connection;
the database driver's own read-only setting independently controls SQL writes.

The editor opens an rc-dock window from the header menu of any Block tagged
`sql-client`. Hosts provide the `manageDatabase(conn, path)` layout action;
opening the window is frontend behavior, separate from commands. Reopening a
Block's window focuses the existing tab and preserves its SQL and results.
It groups entities by catalog and schema, loads columns on expansion, and runs
SQL explicitly with optional bound parameters. Commands do not edit Flow
properties or create history entries. Query results are materialized in memory
and rendered with a virtual table. `getValuePage` pages stored Block outputs.
Refresh metadata after schema changes.
See [command transport](core.md#connection-layer) for HTTP routing.
