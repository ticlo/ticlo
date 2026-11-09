import {Flow, Root} from '../../../block/Flow.ts';
import {ErrorEvent} from '../../../block/Event.ts';
import {DataWrapper} from '../../../block/FunctonData.ts';
import {shouldHappen} from '../../../util/test-util.ts';
import {SqlQueryFunction} from '../Query.ts';
import type {SqlClient, SqlResult} from '../SqlClient.ts';

class QueryData extends DataWrapper {
  output(value: unknown, field = '#output') {
    super.output(value, field);
  }
}

describe('sql:query', () => {
  it('executes only when called and clears old results on failure', async () => {
    const table = {columns: [{name: 'id', type: 'number' as const}], rows: [[1]]};
    const query = vi
      .fn()
      .mockResolvedValueOnce({table, affectedRows: 1, insertId: 1})
      .mockRejectedValueOnce(new Error('query failed'));
    const flow = new Flow();
    try {
      const block = flow.createBlock('query');
      block._load({
        '#is': 'sql:query',
        'client': {query},
        'sql': 'INSERT INTO test VALUES (?) RETURNING id',
        'params': [1],
      });
      block.getProperty('#emit', true);
      Root.run();
      expect(query).not.toHaveBeenCalled();
      block.setValue('params', [2]);
      Root.run();
      expect(query).not.toHaveBeenCalled();

      block.updateValue('#call', {});
      Root.run();
      expect(block.getValue('#wait')).toBe(true);
      await shouldHappen(() => block.getValue('#output') === table);
      expect(query).toHaveBeenCalledWith('INSERT INTO test VALUES (?) RETURNING id', [2]);
      expect(block.getValue('affectedRows')).toBe(1);
      expect(block.getValue('insertId')).toBe(1);

      block.updateValue('#call', {});
      Root.run();
      await shouldHappen(() => block.getValue('#emit') instanceof ErrorEvent);
      expect(block.getValue('#output')).toBeUndefined();
      expect(block.getValue('affectedRows')).toBeUndefined();
      expect(block.getValue('insertId')).toBeUndefined();
    } finally {
      flow.destroy();
    }
  });

  it('discards replaced, canceled, and destroyed asynchronous results', async () => {
    const first = Promise.withResolvers<SqlResult>();
    const second = Promise.withResolvers<SqlResult>();
    const third = Promise.withResolvers<SqlResult>();
    const fourth = Promise.withResolvers<SqlResult>();
    const client: SqlClient = {
      query: vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
        .mockReturnValueOnce(third.promise)
        .mockReturnValueOnce(fourth.promise),
    };
    const data = new QueryData({client, sql: 'SELECT 1'});
    const fn = new SqlQueryFunction(data);
    const oldRun = fn.run();
    const newRun = fn.run();
    const table: SqlResult['table'] = {columns: [], rows: [[2]]};
    second.resolve({table});
    await newRun;
    first.resolve({table: {columns: [], rows: [[1]]}});
    await oldRun;
    expect(data.outputs['#output']).toBe(table);

    const canceled = fn.run();
    fn.cancel();
    third.resolve({table});
    await canceled;
    expect(data.outputs['#output']).toBeUndefined();

    const destroyed = fn.run();
    fn.destroy();
    fourth.resolve({table});
    await destroyed;
    expect(data.outputs['#output']).toBeUndefined();
  });

  it('rejects invalid inputs before calling the service', async () => {
    const query = vi.fn();
    const data = new QueryData({sql: 'SELECT 1'});
    const fn = new SqlQueryFunction(data);
    await expect(fn.run()).rejects.toThrow('Invalid SQL client');
    data.inputs.client = {query};
    data.inputs.sql = ' ';
    await expect(fn.run()).rejects.toThrow('non-empty string');
    data.inputs.sql = 'SELECT 1';
    data.inputs.params = 1;
    await expect(fn.run()).rejects.toThrow('array or object');
    expect(query).not.toHaveBeenCalled();
  });
});
