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

/** Keep identifier parts separate; names may themselves contain dots. */
export interface SqlEntityRef {
  catalog?: string;
  schema?: string;
  name: string;
}

export interface SqlEntity extends SqlEntityRef {
  kind: 'table' | 'view';
}

export interface SqlEntityColumn {
  name: string;
  databaseType?: string;
  nullable?: boolean;
  primaryKey?: boolean;
  defaultExpression?: string;
}

/** A runtime service. SQL syntax and parameter placeholders belong to the adapter. */
export interface SqlClient {
  query(sql: string, params?: SqlParams): Promise<SqlResult>;
  listEntities(): Promise<SqlEntity[]>;
  getColumns(entity: SqlEntityRef): Promise<SqlEntityColumn[]>;
}
