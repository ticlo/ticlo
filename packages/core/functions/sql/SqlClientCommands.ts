import type {FunctionApi} from '../../block/BlockFunction.ts';
import type {FunctionCommandDesc, PropDesc} from '../../block/Descriptor.ts';
import {isDataMap} from '../../util/DataTypes.ts';
import type {SqlClient, SqlEntityRef, SqlParams} from './SqlClient.ts';

const entityParameters: PropDesc[] = [
  {name: 'catalog', type: 'string'},
  {name: 'schema', type: 'string'},
  {name: 'name', type: 'string'},
];

/** Shared by database adapters; opening the management dialog is a frontend concern. */
export const sqlClientCommands: Record<string, FunctionCommandDesc> = {
  listEntities: {
    parameters: [],
    results: [
      {
        name: 'entities',
        type: 'table',
        rowType: 'object',
        columns: [
          ...entityParameters.map(({name, ...desc}) => ({key: name, ...desc})),
          {key: 'kind', type: 'select', options: ['table', 'view']},
        ],
      },
    ],
    readonly: true,
  },
  getColumns: {
    parameters: entityParameters,
    results: [
      {
        name: 'columns',
        type: 'table',
        rowType: 'object',
        columns: [
          {key: 'name', type: 'string'},
          {key: 'databaseType', type: 'string'},
          {key: 'nullable', type: 'toggle'},
          {key: 'primaryKey', type: 'toggle'},
          {key: 'defaultExpression', type: 'string'},
        ],
      },
    ],
    readonly: true,
  },
  query: {
    parameters: [
      {name: 'sql', type: 'string', mime: 'sql'},
      {name: 'params', type: 'any'},
    ],
    results: [
      {name: 'table', type: 'table'},
      {name: 'affectedRows', type: 'number'},
      {name: 'insertId', type: 'any', types: ['number', 'string']},
    ],
    largeData: true,
  },
};

export const sqlClientApi: FunctionApi = {
  commands: {
    async listEntities(block) {
      const client = block.getValue('#output') as SqlClient;
      if (!client?.listEntities) throw new Error('SQL client is not ready');
      return {entities: await client.listEntities()};
    },
    async getColumns(block, {catalog, schema, name}: Partial<SqlEntityRef> = {}) {
      if (
        typeof name !== 'string' ||
        !name ||
        (schema !== undefined && typeof schema !== 'string') ||
        (catalog !== undefined && typeof catalog !== 'string')
      )
        throw new Error('Invalid SQL entity');
      const client = block.getValue('#output') as SqlClient;
      if (!client?.getColumns) throw new Error('SQL client is not ready');
      return {columns: await client.getColumns({catalog, schema, name})};
    },
    query(block, {sql, params} = {}, readonly) {
      if (readonly) throw new Error('SQL execution is unavailable on a readonly connection');
      if (typeof sql !== 'string' || !sql.trim()) throw new Error('SQL is required');
      if (params !== undefined && !Array.isArray(params) && !isDataMap(params)) {
        throw new Error('SQL parameters must be an array or object');
      }
      const client = block.getValue('#output') as SqlClient;
      if (!client?.query) throw new Error('SQL client is not ready');
      return client.query(sql, params as SqlParams);
    },
  },
};
