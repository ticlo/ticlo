import {describe, expect, it} from 'vitest';
import {once} from 'node:events';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {Root} from '@ticlo/core';
import {WsClientConnection} from '@ticlo/node/connect/WsClientConnection.js';
import {AsyncClientPromise} from '@ticlo/core/connect/__spec__/AsyncClientPromise.js';
import {connectTiclo, getEditorUrl} from '../server.js';

describe('connectTiclo', () => {
  it('upgrades editor WebSockets and exchanges flow values through the Node adapter', async () => {
    const app = new Hono();
    const {injectWebSocket} = await connectTiclo(app, '/ticlo');
    const server = serve({fetch: app.fetch, hostname: '127.0.0.1', port: 0});
    injectWebSocket(server);
    const flow = Root.instance.addFlow('honoWebSocket');
    flow.setValue('value', 42);
    const callbacks = new AsyncClientPromise();
    let client: WsClientConnection;
    try {
      await once(server, 'listening');
      const address = server.address();
      if (typeof address !== 'object' || !address) throw new Error('Missing server address');
      client = new WsClientConnection(`ws://127.0.0.1:${address.port}/ticlo`, false);
      client.subscribe('honoWebSocket.value', callbacks);
      expect((await callbacks.promise).cache.value).toBe(42);
      const update = callbacks.promise;
      flow.setValue('value', 43);
      expect((await update).cache.value).toBe(43);
    } finally {
      callbacks.cancel();
      client?.destroy();
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
      Root.instance.deleteValue('honoWebSocket');
    }
  });
});

describe('getEditorUrl', () => {
  it('keeps host and flow values isolated from editor query parameters', () => {
    const host = 'wss://example.test/ticlo?token=a&flow=host-value';
    const flow = 'folder.name&host=flow-value';
    const url = new URL(getEditorUrl(host, flow));

    expect(url.protocol).toBe('https:');
    expect(url.searchParams.get('host')).toBe(host);
    expect(url.searchParams.get('flow')).toBe(flow);
    expect([...url.searchParams.keys()]).toEqual(['host', 'flow']);
  });
});
