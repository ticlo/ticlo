import {Root, ErrorEvent, type Block, type LogProvider, type SqlResult} from '../../../index.ts';

const record = {time: 1700000000123, level: 'warn' as const, message: 'slow', data: false};

it('shares one table setup across concurrent writers and runs one INSERT per record', async () => {
  const root = new Root();
  try {
    const creating = Promise.withResolvers<SqlResult>();
    const query = vi.fn().mockReturnValueOnce(creating.promise).mockResolvedValue({});
    const client = {dialect: 'sqlite', query};
    const flow = root.addFlow('Main', {
      first: {'#is': 'sql:log-provider'},
      second: {'#is': 'sql:log-provider'},
    });
    const first = flow.getValue('first') as Block;
    const second = flow.getValue('second') as Block;
    first.updateValue('client', client);
    second.updateValue('client', client);
    root.runAll();
    const provider = first.getValue('#output') as LogProvider;
    const other = second.getValue('#output') as LogProvider;
    expect(query).not.toHaveBeenCalled();
    const writes = [provider.write(record), other.write(record)];
    expect(query).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS "ticlo_log"'));
    creating.resolve({});
    await Promise.all(writes);
    await provider.write(record);
    expect(query.mock.calls.slice(1)).toEqual(
      Array(3).fill([
        expect.stringContaining('INSERT INTO "ticlo_log"'),
        [record.time, 'warn', 'slow', null, null, 'false'],
      ])
    );

    first.setValue('tableName', 'next');
    root.runAll();
    await (first.getValue('#output') as LogProvider).write(record);
    expect(query.mock.calls[4][0]).toContain('CREATE TABLE IF NOT EXISTS "next"');
    const replacement = {dialect: 'postgres', query: vi.fn().mockResolvedValue({})};
    first.updateValue('client', replacement);
    root.runAll();
    await (first.getValue('#output') as LogProvider).write(record);
    expect(replacement.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS "next"');
    expect(replacement.query.mock.calls[1][0]).toContain('VALUES ($1, $2, $3, $4, $5, $6)');
    first.setValue('tableName', '界'.repeat(22));
    root.runAll();
    expect(first.getValue('#output')).toBeUndefined();
    expect(first.getValue('#emit')).toBeInstanceOf(ErrorEvent);
    expect(replacement.query).toHaveBeenCalledTimes(2);
  } finally {
    root.destroy();
  }
});

it('retries failed initialization and surfaces ambiguous write failures without replaying the record', async () => {
  const root = new Root();
  try {
    const query = vi.fn().mockRejectedValueOnce(new Error('create denied')).mockResolvedValue({});
    const flow = root.addFlow('Main', {sink: {'#is': 'sql:log-provider'}});
    const sink = flow.getValue('sink') as Block;
    sink.updateValue('client', {query, dialect: 'sqlite'});
    root.runAll();
    const provider = sink.getValue('#output') as LogProvider;
    await expect(provider.write(record)).rejects.toThrow('create denied');
    await provider.write(record);
    expect(query.mock.calls.map(([sql]) => sql.split(' ')[0])).toEqual(['CREATE', 'CREATE', 'INSERT']);
    query.mockRejectedValueOnce(new Error('connection lost'));
    await expect(provider.write(record)).rejects.toThrow('connection lost');
    await provider.write(record);
    expect(query.mock.calls.slice(3).map(([sql]) => sql.split(' ')[0])).toEqual(['INSERT', 'INSERT']);
  } finally {
    root.destroy();
  }
});
