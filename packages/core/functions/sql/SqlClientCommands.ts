import type {FunctionApi} from '../../block/BlockFunction.ts';
import type {FunctionCommandDesc} from '../../block/Descriptor.ts';
import {isDataMap} from '../../util/DataTypes.ts';
import type {SqlClient, SqlEntityRef, SqlParams} from './SqlClient.ts';

/** Shared by database adapters; opening the management dialog is a frontend concern. */
export const sqlClientCommands: Record<string, FunctionCommandDesc> = {
  listEntities: {parameters: [], readonly: true, hidden: true},
  getColumns: {parameters: [{name: 'entity', type: 'object'}], readonly: true, hidden: true},
  query: {
    parameters: [
      {name: 'sql', type: 'string', mime: 'sql'},
      {name: 'params', type: 'any'},
    ],
    largeData: true,
    hidden: true,
  },
};

export const sqlClientApi: FunctionApi = {
  commands: {
    listEntities(block) {
      const client = block.getValue('#output') as SqlClient;
      if (!client?.listEntities) throw new Error('SQL client is not ready');
      return client.listEntities();
    },
    getColumns(block, {entity} = {}) {
      if (
        !isDataMap(entity) ||
        typeof entity.name !== 'string' ||
        !entity.name ||
        (entity.schema !== undefined && typeof entity.schema !== 'string') ||
        (entity.catalog !== undefined && typeof entity.catalog !== 'string')
      )
        throw new Error('Invalid SQL entity');
      const client = block.getValue('#output') as SqlClient;
      if (!client?.getColumns) throw new Error('SQL client is not ready');
      return client.getColumns(entity as unknown as SqlEntityRef);
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
