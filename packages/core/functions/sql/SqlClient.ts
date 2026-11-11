import type {PropDesc} from '../../block/Descriptor.ts';

export type SqlParams = unknown[] | Record<string, unknown>;

export interface SqlStatement {
  sql: string;
  params?: SqlParams;
}

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
  /** Atomically execute the statements and return the final statement's result. */
  transaction?(statements: readonly SqlStatement[]): Promise<SqlResult>;
  listEntities(): Promise<SqlEntity[]>;
  getColumns(entity: SqlEntityRef): Promise<SqlEntityColumn[]>;
}

export function validateSqlTransaction(statements: readonly SqlStatement[]) {
  if (!Array.isArray(statements) || !statements.length) throw new Error('SQL transaction requires statements');
  for (const [index, statement] of statements.entries()) {
    // Keep transaction control and statements with implicit commits out of the batch.
    if (
      typeof statement?.sql !== 'string' ||
      !/^\s*(?:SELECT|WITH|VALUES|TABLE|INSERT|UPDATE|DELETE|MERGE)\b/i.test(statement.sql) ||
      (statement.params !== undefined && !Array.isArray(statement.params) && !Object.isExtensible(statement.params))
    ) {
      throw new Error(`Invalid SQL transaction statement ${index + 1}: expected a query or data modification`);
    }
  }
}

export function sqlColumns<T>(
  fields: readonly T[],
  nameOf: (field: T) => string,
  typeOf: (field: T) => string | undefined
): SqlColumn[] {
  const reserved = new Set(fields.map(nameOf));
  const used = new Set<string>();
  return fields.map((field, index) => {
    const sourceName = nameOf(field);
    const base = sourceName || `column${index + 1}`;
    let name = base;
    for (let suffix = 2; used.has(name); ++suffix) {
      name = `${base}_${suffix}`;
      while (reserved.has(name)) name = `${base}_${++suffix}`;
    }
    used.add(name);
    return {name, type: 'any', sourceName, databaseType: typeOf(field)};
  });
}
