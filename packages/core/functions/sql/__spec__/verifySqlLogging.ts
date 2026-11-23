import {expect} from 'vitest';
import {Root, ErrorEvent, decode, shouldHappen, type Block, type SqlClient} from '../../../index.ts';

// Run the same log -> provider -> database flow against each real driver.
export async function verifySqlLogging(client: SqlClient) {
  const root = new Root();
  const id = crypto.randomUUID();
  const quote = client.dialect === 'mysql' ? '`' : '"';
  const tableName = `log${quote}${id}`;
  const table = `${quote}log${quote}${quote}${id}${quote}`;
  try {
    const flow = root.addFlow('Main', {
      'source': {'#is': ''},
      '^audit': {'#is': 'sql:log-provider', tableName},
      'log': {'#is': 'log', '~provider': '^audit.#output', '~#call': '##.source.#emit', 'message': "It's ready"},
    });
    const log = flow.getValue('log') as Block;
    const source = flow.getValue('source') as Block;
    (flow.getValue('^audit') as Block).updateValue('client', client);
    root.runAll();
    const start = Date.now();
    source.emit(true);
    root.runAll();
    await shouldHappen(() => !log.getValue('#wait'));
    const read = async () =>
      (await client.query(`SELECT time, level, message, block_path, origin_path, data FROM ${table}`)).table.rows;
    const [row] = await read();
    expect(Number(row[0])).toBeGreaterThanOrEqual(start);
    expect(Number(row[0])).toBeLessThanOrEqual(Date.now());
    expect(row.slice(1)).toEqual(['info', "It's ready", 'Main.log', 'Main.source', null]);

    await client.query(`DROP TABLE ${table}`);
    const failure = new ErrorEvent('query', new TypeError('Bad value'));
    source.emit(failure);
    root.runAll();
    await shouldHappen(() => log.getValue('#emit') === failure);
    const rows = await read();
    expect(rows).toHaveLength(1);
    expect(rows[0].slice(1, 5)).toEqual(['error', 'query: Bad value', 'Main.log', 'Main.source']);
    expect(decode(rows[0][5] as string)).toMatchObject({name: 'TypeError', message: 'Bad value'});
  } finally {
    root.destroy();
    await client.query(`DROP TABLE IF EXISTS ${table}`);
  }
}
