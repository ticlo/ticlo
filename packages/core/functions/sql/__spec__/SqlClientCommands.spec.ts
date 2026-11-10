import {Root} from '../../../block/Flow.ts';
import {globalFunctions} from '../../../block/FunctionModule.ts';
import {MemoryFlowStorage} from '../../../block/MemoryFlowStorage.ts';
import {makeLocalConnection} from '../../../connect/LocalConnection.ts';
import {escapedObject} from '../../../util/NoSerialize.ts';
import {shouldHappen} from '../../../util/test-util.ts';
import {sqlClientApi, sqlClientCommands} from '../SqlClientCommands.ts';
import type {SqlResult} from '../SqlClient.ts';

globalFunctions.addFactory(
  null,
  {
    name: 'sql-client-commands-test',
    properties: [],
    tags: ['sql-client'],
    commands: sqlClientCommands,
  },
  undefined,
  sqlClientApi
);

describe('SQL client commands', () => {
  it('reads metadata from readonly storage without trusting transport permission hints', async () => {
    const root = new Root();
    const query = vi.fn();
    root.defineGlobal('database', {
      '#is': 'sql-client-commands-test',
      '#output': escapedObject('sql-client-test', {query, listEntities: async (): Promise<[]> => []}),
    });
    const storage = Object.assign(new MemoryFlowStorage(), {canWriteFlow: () => false});
    await root.setStorage(storage);
    const [, client] = makeLocalConnection(root, false);
    try {
      expect(await client.executeCommand('#global.^database', 'listEntities')).toMatchObject({result: []});
      await expect(
        client.simpleRequest({
          cmd: 'executeCommand',
          path: '#global.^database',
          command: 'query',
          params: {sql: 'DELETE FROM items'},
          readonly: true,
          largeData: true,
        })
      ).rejects.toBe('Storage is read-only');
      expect(query).not.toHaveBeenCalled();
    } finally {
      client.destroy();
      root.destroy();
    }
  });

  it('awaits void commands before tracking their Flow changes', async () => {
    const gate = Promise.withResolvers<void>();
    const command = vi.fn(async (block) => {
      await gate.promise;
      block.setValue('value', 2);
    });
    globalFunctions.addFactory(null, {name: 'async-void-command-test', properties: []}, undefined, {
      commands: {update: command},
    });
    const root = new Root();
    const flow = root.addFlow('Test', {block: {'#is': 'async-void-command-test', 'value': 1}});
    const changed = vi.spyOn(flow, 'trackChange');
    const [, client] = makeLocalConnection(root, false);
    try {
      const response = client.executeCommand('Test.block', 'update');
      await shouldHappen(() => command.mock.calls.length === 1);
      expect(changed).not.toHaveBeenCalled();
      gate.resolve();
      expect(await response).toBeUndefined();
      expect(root.queryValue('Test.block.value')).toBe(2);
      expect(changed).toHaveBeenCalledOnce();
    } finally {
      gate.resolve();
      client.destroy();
      root.destroy();
    }
  });

  it.each([true, false])(
    'awaits full results without editing code-defined blocks (serialize=%s)',
    async (serialize) => {
      const pending = Promise.withResolvers<SqlResult>();
      const query = vi
        .fn()
        .mockReturnValueOnce(pending.promise)
        .mockRejectedValueOnce(Object.assign(new Error('invalid SQL'), {code: 'SQL_TEST'}));
      const entity = {catalog: 'catalog', schema: 'a.b', name: 'quoted".table', kind: 'table' as const};
      const columns = [{name: 'value', databaseType: 'BLOB', nullable: true}];
      const getColumns = vi.fn().mockResolvedValue(columns);
      const service = escapedObject('sql-client-test', {query, getColumns, listEntities: async () => [entity]});
      const root = new Root();
      const block = root.defineGlobal('database', {'#is': 'sql-client-commands-test', '#output': service});
      const [, client] = makeLocalConnection(root, false, undefined, serialize);
      const changed = vi.spyOn(root._globalRoot, 'trackChange');
      try {
        expect(await client.executeCommand('#global.^database', 'listEntities')).toMatchObject({result: [entity]});
        expect(await client.executeCommand('#global.^database', 'getColumns', {entity})).toMatchObject({
          result: columns,
        });
        expect(getColumns).toHaveBeenCalledWith(entity);
        let completed = false;
        const response = (
          client.executeCommand('#global.^database', 'query', {sql: 'SELECT ?', params: [1]}) as Promise<any>
        ).then((value) => {
          completed = true;
          return value;
        });
        await shouldHappen(() => query.mock.calls.length === 1);
        expect(completed).toBe(false);
        const table = {
          columns: [{name: 'value', type: 'any' as const}],
          rows: Array.from({length: 2000}, (_, index) => [index]),
        };
        pending.resolve({table});
        expect((await response).result.table.rows).toEqual(table.rows);
        expect(query).toHaveBeenCalledWith('SELECT ?', [1]);
        await expect(
          client.executeCommand('#global.^database', 'query', {sql: 'invalid'}) as Promise<any>
        ).rejects.toMatchObject({name: 'Error', message: 'invalid SQL', code: 'SQL_TEST'});
        expect(changed).not.toHaveBeenCalled();
        expect(block.getValue('#output')).toBe(service);
      } finally {
        client.destroy();
        root.destroy();
      }
    }
  );

  it('allows metadata but rejects SQL execution on a readonly server', async () => {
    const query = vi.fn();
    const root = new Root();
    root.defineGlobal('database', {
      '#is': 'sql-client-commands-test',
      '#output': escapedObject('sql-client-test', {query, listEntities: async (): Promise<[]> => []}),
    });
    const [server, client] = makeLocalConnection(root, false, {readonly: true, allowPaths: ['#global.^database']});
    try {
      expect(await client.executeCommand('#global.^database', 'listEntities')).toMatchObject({result: []});
      await expect(
        client.executeCommand('#global.^database', 'query', {sql: 'DELETE FROM test'}) as Promise<any>
      ).rejects.toThrow('readonly');
      expect(query).not.toHaveBeenCalled();
      server.setEditPolicy({readonly: true, denyPaths: ['#global.**']});
      await expect(client.executeCommand('#global.^database', 'listEntities') as Promise<any>).rejects.toBe(
        'restricted path'
      );
    } finally {
      client.destroy();
      root.destroy();
    }
  });
});
