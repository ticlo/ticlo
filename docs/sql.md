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

The function defaults to `onLoad`, which runs it when the block loads and when
inputs change. It skips execution while the client is unavailable. For explicit
execution, set `#mode` to `onCall` and trigger `#call`. Normal Block `#wait` and
`#emit` events report completion or errors. Canceling or replacing a call
discards its eventual output. Database writes that already ran still take effect.

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

## Database connectors

SQLite (`sqlite-client`), PostgreSQL (`postgres-client`), and MySQL
(`mysql-client`) appear under Database in the function selector.
For existing flows, update the saved function IDs to the corresponding IDs below.

| Previous ID | Current ID |
| --- | --- |
| `database:sqlite` | `sqlite:client` |
| `database:postgres` | `postgres:client` |
| `database:mysql` | `mysql:client` |

### SQLite

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

### PostgreSQL

Import `@ticlo/postgres` in Node.js to register `postgres:client`. The development
server imports it. Enter a URL such as `postgresql://app@db.example:5432/mydb` in
`connectionString`. See [SQL authentication](#sql-authentication) for password
setup. The Block opens a pool on load and replaces it when its configuration changes. `maxConnections` defaults
to 10, `connectionTimeout` to 5000 ms, and `statementTimeout` to 30000 ms.
Set a timeout to 0 to disable it.

Use positional placeholders such as `$1` with an array. A statement with
`RETURNING` includes a table, and write statements report the driver's affected
row count. Use `RETURNING id` to retrieve generated IDs. `bigint`, `numeric`,
and calendar and timestamp values are returned as text to preserve precision.
`bytea` values are returned as `Uint8Array`. Use `sql:transaction` for a group
of statements that must share a transaction.

Run `pnpm test connectors/postgres` to exercise the connector. Locally, the
suite uses a `postgres:18` Podman container with SCRAM authentication on an
available loopback port. The Git-ignored
`connectors/postgres/__spec__/postgres.podman.local.cid` records its ID.
Later runs reuse the container and start it if stopped. The local test database
and username are both `postgres`, and the password is `ticlo_test`. Each run
drops its own test schema. Set `TICLO_TEST_POSTGRES_URL` to use a disposable
database with SCRAM authentication that allows the test account to create and
drop schemas. GitHub Actions supplies that URL from a PostgreSQL service managed
by the runner.

### MySQL and MariaDB

Import `@ticlo/mysql` in a Node.js host to register `mysql:client`. The
development server imports it. Set `connectionString` to a URL such as
`mysql://app@127.0.0.1:3306/mydb`. For password authentication, use the
[SQL authentication setup](#sql-authentication). Add `?ssl=true` to use TLS
with certificate verification. `maxConnections` defaults to 10 and
`connectionTimeout` defaults to 5000 ms.

Use `?` placeholders with an array of values. Results preserve `BIGINT`,
`DECIMAL`, and date and time values as strings and return binary columns as
`Uint8Array`. Use transactional tables such as InnoDB with `sql:transaction`.
The connector validates the batch and rolls back on statement errors.

Run `pnpm test connectors/mysql` to test MariaDB 11.8 compatibility and MySQL
8.4 authentication with `caching_sha2_password`. Locally, both use Podman with
database `ticlo_test`, user `root`, and password `ticlo_test`. Use
`TICLO_TEST_MYSQL_URL` to supply a test database with permission to create and
drop databases. Use `TICLO_TEST_MYSQL84_URL` to supply a MySQL 8.4 test database
with a `caching_sha2_password` account that can read its row in `mysql.user`.
GitHub Actions supplies both URLs through service containers.

### SQL authentication

Choose `auth:password` in the Block's `auth` field or bind it to an existing
password Auth Block. The database Block keeps its password in
[`#secret`](runtime-lifecycle.md#block-secrets). An existing
embedded [`system:env` Block](runtime-lifecycle.md#system-functions) can supply it.
Leave `auth` empty for connections without a password.

To upgrade a saved Flow that already sets `#secret` directly or through a
binding, select `auth:password` in the editor and save. In saved Block data,
the equivalent edit adds `"~auth": {"#is": "auth:password"}` next to the
existing secret configuration. Move any URL password into `#secret` and
remove it from the URL.

## Client management

`SqlClient` provides `query(sql, params?)`, `listEntities()` and
`getColumns(entity)`. It can also provide `transaction(statements)` and
`queryReadonly(sql, params?)`. Entities are
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
connection's `{result}` response wrapper. Commands do not paginate or truncate
results. The `query` command calls `queryReadonly` when
[executing in readonly mode](core.md#connection-layer). An adapter must provide
that method to run queries in this mode.

SQLite enables `PRAGMA query_only` for the statement, rejects connection and
transaction control statements, and restores the previous setting afterward.
PostgreSQL and MySQL run the query inside a read-only transaction and roll it
back before returning the pooled connection. These two adapters require a
leading query keyword, such as `SELECT` or `WITH`. MySQL also blocks file
exports from readonly queries.

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
