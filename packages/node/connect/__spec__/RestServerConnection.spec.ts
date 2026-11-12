import {describe, expect, it} from 'vitest';
import {Root, decode, globalFunctions} from '@ticlo/core';
import {RestServerConnection} from '../RestServerConnection.ts';

describe('RestServerConnection', () => {
  it('awaits full command results and transports native errors without retrying execution', async () => {
    const command = vi
      .fn()
      .mockResolvedValueOnce({binary: new Uint8Array([1, 255]), rows: Array.from({length: 2000}, (_, i) => [i])})
      .mockRejectedValueOnce(Object.assign(new Error('SQL failed'), {code: 'SQL_TEST'}));
    globalFunctions.addFactory(null, {name: 'rest-command-test', properties: []}, undefined, {
      commands: {query: command},
    });
    const root = new Root();
    root.defineGlobal('database', {'#is': 'rest-command-test'});
    const connection = new RestServerConnection(root);
    let sent: string;
    const response = {
      send(data: string) {
        sent = data;
      },
      status() {
        return this;
      },
      header() {
        return this;
      },
    };
    try {
      const body = {cmd: 'executeCommand', path: '#global.^database', command: 'query', params: {sql: 'SELECT 1'}};
      await connection.onHttpPost({body}, response);
      const result = decode(sent).result;
      expect(result.rows).toHaveLength(2000);
      expect(result.rows.at(-1)).toEqual([1999]);
      expect(result.binary).toEqual(new Uint8Array([1, 255]));
      await connection.onHttpPost({body}, response);
      expect(decode(sent)).toMatchObject({
        cmd: 'error',
        error: {name: 'Error', message: 'SQL failed', code: 'SQL_TEST'},
      });
      expect(command).toHaveBeenCalledTimes(2);
    } finally {
      connection.destroy();
      root.destroy();
    }
  });

  it('waits for persistence and reports asynchronous save failures', async () => {
    const root = new Root();
    let finish: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const flow = root.addFlow(
      'Main',
      {},
      {
        applyChange: async (flow) => {
          await pending;
          return flow.save();
        },
      }
    );
    const connection = new RestServerConnection(root);
    let result: unknown;
    const response = {
      send(data: unknown) {
        result = data;
      },
      status() {
        return this;
      },
      header() {
        return this;
      },
    };
    try {
      const saving = connection.onHttpPost({body: {cmd: 'applyFlowChange', path: 'Main'}}, response);
      await Promise.resolve();
      expect(result).toBeUndefined();
      finish();
      await saving;
      expect(result).toBe('');
      flow._applyChange = async () => {
        throw new Error('save failed');
      };
      await connection.onHttpPost({body: {cmd: 'applyFlowChange', path: 'Main'}}, response);
      expect(result).toEqual({cmd: 'error', msg: 'Error: save failed'});
    } finally {
      connection.destroy();
      root.destroy();
    }
  });
  it('bypasses fine-grained editing limits on writable HTTP requests', async () => {
    const root = new Root();
    const flow = root.addFlow('Main');
    const connection = new RestServerConnection(root, {allowProps: ['value']});
    let result: any;
    const response = {
      send(data: any) {
        result = data;
      },
      status() {
        return this;
      },
      header() {
        return this;
      },
    };
    try {
      await connection.onHttpPost({body: {cmd: 'set', path: 'Main.other', value: 1}}, response);
      expect(result).toBe('');
      expect(flow.getValue('other')).toBe(1);
      await connection.onHttpPost({body: {cmd: 'set', path: 'Main.value', value: 2}}, response);
      expect(flow.getValue('value')).toBe(2);
      connection.setEditPolicy({readonly: true, allowProps: ['value']});
      await connection.onHttpPost({body: {cmd: 'set', path: 'Main.value', value: 3}}, response);
      expect(result).toEqual({cmd: 'error', msg: 'readonly'});
      expect(flow.getValue('value')).toBe(2);
    } finally {
      connection.destroy();
      root.destroy();
    }
  });
  it('rejects prototype members that are not commands', async () => {
    const root = new Root();
    const connection = new RestServerConnection(root);
    let responseStatus = 200;
    let sent = false;
    const response = {
      send() {
        sent = true;
      },
      status(status: number) {
        responseStatus = status;
        return this;
      },
      header() {
        return this;
      },
    };

    await connection.onHttpPost({body: {cmd: 'constructor'}}, response);

    expect(responseStatus).toBe(400);
    expect(sent).toBe(true);
    connection.destroy();
    root.destroy();
  });

  it('enforces read paths and readonly paths on HTTP requests', async () => {
    const root = new Root();
    root.addFlow('Main', {value: 1});
    root.addFlow('Other', {value: 2});
    const connection = new RestServerConnection(root, {
      readonly: true,
      allowPaths: ['Main.**'],
      readonlyPaths: ['Other.value'],
    });
    let result: any;
    const response = {
      send(data: any) {
        result = data;
      },
      status() {
        return this;
      },
      header() {
        return this;
      },
    };
    try {
      await connection.onHttpPost({body: {cmd: 'get', path: 'Other.value'}}, response);
      expect(JSON.parse(result)).toEqual({value: 2});
      await connection.onHttpPost({body: {cmd: 'get', path: 'Other'}}, response);
      expect(result).toEqual({cmd: 'error', msg: 'restricted path'});
      await connection.onHttpPost({body: {cmd: 'set', path: 'Other.value', value: 3}}, response);
      expect(result).toEqual({cmd: 'error', msg: 'readonly'});
      await connection.onHttpPost({body: {cmd: 'set', path: 'Main', value: 3}}, response);
      expect(result).toEqual({cmd: 'error', msg: 'readonly'});
      expect(root.queryValue('Main.value')).toBe(1);
    } finally {
      connection.destroy();
      root.destroy();
    }
  });
});
