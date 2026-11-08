import {describe, expect, it} from 'vitest';
import {once} from 'node:events';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {Root, type Block} from '@ticlo/core';
import {WsClientConnection} from '@ticlo/node/connect/WsClientConnection.ts';
import {AsyncClientPromise} from '@ticlo/core/connect/__spec__/AsyncClientPromise.ts';
import {connectTiclo, createTicloApp, getEditorUrl, routeTiclo} from '../server.ts';

it('allows cross-origin runtime reads and flow route responses from the default host', async () => {
  const root = new Root();
  try {
    const {app} = await createTicloApp({root, enableEditor: true});
    const origin = 'http://localhost:3003';
    const preflight = await app.request('/ticlo', {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(preflight.headers.get('Access-Control-Allow-Headers')?.toLowerCase()).toContain('content-type');

    const response = await app.request('/ticlo', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Origin': origin},
      body: JSON.stringify({cmd: 'get', path: '#global.^web-server.#is'}),
    });
    expect(await response.json()).toEqual({value: 'web-server:server'});
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const missing = await app.request('/api/missing', {headers: {Origin: origin}});
    expect(missing.status).toBe(404);
    expect(missing.headers.get('Access-Control-Allow-Origin')).toBe('*');
  } finally {
    root.destroy();
  }
});

describe('connectTiclo', () => {
  it('upgrades editor WebSockets and exchanges flow values through the Node adapter', async () => {
    const app = new Hono();
    const root = new Root();
    const {injectWebSocket} = await connectTiclo(app, '/ticlo', root);
    const server = serve({fetch: app.fetch, hostname: '127.0.0.1', port: 0});
    injectWebSocket(server);
    const flow = root.addFlow('honoWebSocket');
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
      root.destroy();
    }
  });
});

describe('routeTiclo', () => {
  it('keeps the editor-visible server type connected to HTTP routes across global restarts', async () => {
    const root = new Root();
    const globals = root._globalRoot;
    const app = new Hono();
    try {
      await routeTiclo(app, '/api', 'typed-server', root);
      const service = root.queryValue('#global.^typed-server') as Block;
      const output = service.getValue('#output');
      expect(service.getValue('#is')).toBe('web-server:server');
      expect(service.getFunctionClass()).toBeUndefined();
      root.addFlow('serverIdentityRoute', {
        route: {
          '#is': 'web-server:route',
          'path': '/identity',
          'method': ['GET'],
          'contentType': ['empty'],
          '~server': '^typed-server.#output',
        },
      });
      root.runAll();
      expect((await app.request('/api/identity')).status).toBe(501);
      globals.setValue('#disabled', true);
      globals.setValue('#disabled', false);
      root.runAll();
      expect(service.getValue('#output')).toBe(output);
      expect((await app.request('/api/identity')).status).toBe(501);
    } finally {
      root.destroy();
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
