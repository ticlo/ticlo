import type {PropDesc} from '../../block/Descriptor.ts';

export type SqlParams = unknown[] | Record<string, unknown>;

export interface SqlColumn extends PropDesc {
  /** Original column name, before disambiguating duplicate names for the editor. */
  sourceName?: string;
  databaseType?: string;
}

export interface SqlTable {
  columns: SqlColumn[];
  rows: unknown[][];
}

export interface SqlResult {
  /** Absent when the statement does not produce a result set. */
  table?: SqlTable;
  affectedRows?: number;
  /** Optional driver-provided insert identifier; large integers remain strings. */
  insertId?: number | string;
}

/** A runtime service. SQL syntax and parameter placeholders belong to the adapter. */
export interface SqlClient {
  query(sql: string, params?: SqlParams): Promise<SqlResult>;
}
