import {afterEach, describe, expect, it, vi} from 'vitest';
import axios from 'axios';
import {Logger} from '@ticlo/core';
import {MixedBrowserConnection} from '../MixedBrowserConnection.js';
import {WsBrowserConnection} from '../WsBrowserConnection.js';

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
});
