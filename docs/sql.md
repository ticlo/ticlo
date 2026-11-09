# SQL clients

Core registers `sql:query` and exports the `SqlClient`, `SqlParams`, `SqlResult`,
and `SqlTable` types. Database connectors expose runtime services implementing
`SqlClient.query(sql, params?)`. Connection functions have the `sql-client` tag;
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

Query results are materialized in memory. Editor paging reads those results;
it does not make database execution lazy. Transactions, streaming cursors,
multi-statement batches, and database-specific utilities are outside this initial
connector API.
