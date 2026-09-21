import {describe, expect, it} from 'vitest';
import {Root} from '@ticlo/core';
import {RestServerConnection} from '../RestServerConnection.ts';

describe('RestServerConnection', () => {
  it('enforces editing policy on HTTP requests', async () => {
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
      expect(result).toEqual({cmd: 'error', msg: 'restricted property'});
      expect(flow.getValue('other')).toBeUndefined();
      await connection.onHttpPost({body: {cmd: 'set', path: 'Main.value', value: 2}}, response);
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
      expect(result).toEqual({cmd: 'error', msg: 'restricted path'});
      await connection.onHttpPost({body: {cmd: 'set', path: 'Main', value: 3}}, response);
      expect(result).toEqual({cmd: 'error', msg: 'restricted path'});
      expect(root.queryValue('Main.value')).toBe(1);
    } finally {
      connection.destroy();
      root.destroy();
    }
  });
});
