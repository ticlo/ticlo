import {afterEach, describe, expect, it, vi} from 'vitest';
import axios from 'axios';
import {Logger, encode} from '@ticlo/core';
import {DateTime} from 'luxon';
import {MixedBrowserConnection} from '../MixedBrowserConnection.ts';
import {WsBrowserConnection} from '../WsBrowserConnection.ts';

class MockWebSocket extends EventTarget {
  close = vi.fn();
  send = vi.fn();
}

describe('WsBrowserConnection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('disconnects when the browser WebSocket closes', () => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    const connection = new WsBrowserConnection('ws://example.test', false);
    const socket = connection._ws;
    socket.dispatchEvent(new Event('open'));

    socket.dispatchEvent(new Event('close'));

    expect(connection._connected).toBe(false);
    connection.destroy();
  });

  it('ignores events from a replaced WebSocket', () => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    const connection = new WsBrowserConnection('ws://example.test', false);
    const first = connection._ws;
    const receive = vi.spyOn(connection, 'onReceive');

    connection.reconnect();
    const second = connection._ws;
    first.dispatchEvent(new Event('open'));
    expect(connection._connected).not.toBe(true);
    second.dispatchEvent(new Event('open'));
    first.dispatchEvent(new MessageEvent('message', {data: '[]'}));
    first.dispatchEvent(new Event('error'));
    first.dispatchEvent(new Event('close'));

    expect(connection._ws).toBe(second);
    expect(connection._connected).toBe(true);
    expect(receive).not.toHaveBeenCalled();
    second.dispatchEvent(new MessageEvent('message', {data: '[]'}));
    expect(receive).toHaveBeenCalledOnce();
    connection.destroy();
  });

  it('ignores malformed WebSocket messages', () => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => {});
    const connection = new WsBrowserConnection('ws://example.test', false);

    connection._ws.dispatchEvent(new MessageEvent('message', {data: '{invalid json'}));

    expect(warn).toHaveBeenCalledOnce();
    connection.destroy();
  });

  it('forwards REST protocol error messages', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({data: {cmd: 'error', msg: 'invalid path'}});
    const connection = Object.create(MixedBrowserConnection.prototype) as MixedBrowserConnection;
    (connection as any)._httpUrl = 'http://example.test/ticlo';
    const onError = vi.fn();

    connection._sendLargeData({cmd: 'set'}, {onError});

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('invalid path'));
  });

  it('routes large-data commands over HTTP and never retries failed queries through WebSocket', async () => {
    const rest = vi.spyOn(axios, 'post').mockRejectedValue(new Error('request failed'));
    vi.stubGlobal('WebSocket', MockWebSocket);
    const connection = new MixedBrowserConnection('http://example.test', false);
    const ws = vi.spyOn(WsBrowserConnection.prototype, 'sendRequest' as any).mockReturnValue('ws-request');
    try {
      expect(connection.executeCommand('database', 'listEntities', undefined, {})).toBe('ws-request');
      expect(ws).toHaveBeenCalledOnce();
      await expect(
        connection.executeCommand('database', 'query', {sql: 'INSERT INTO items VALUES (1)'}, undefined, {
          largeData: true,
        }) as Promise<any>
      ).rejects.toContain('request failed');
      expect(rest).toHaveBeenCalledOnce();
      expect(ws).toHaveBeenCalledOnce();
    } finally {
      connection.destroy();
    }
  });

  it('decodes Arrow values in REST pages before using them as anchors', async () => {
    const row = {date: DateTime.utc(2026), binary: new Uint8Array([1, 2])};
    vi.spyOn(axios, 'post').mockImplementation(async (_url, _data, config) => {
      const [transform] = config.transformResponse as ((data: string) => unknown)[];
      return {data: transform(encode({items: [row], offset: 0, total: 2}))};
    });
    const connection = Object.create(MixedBrowserConnection.prototype) as MixedBrowserConnection;
    (connection as any)._httpUrl = 'http://example.test/ticlo';
    const result = await connection.getValuePage('Main.items', {offset: 0, limit: 1});
    expect(result.items).toEqual([row]);
    expect(DateTime.isDateTime((result.items[0] as any).date)).toBe(true);
  });
});
