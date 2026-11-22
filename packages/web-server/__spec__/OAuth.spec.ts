import {once} from 'node:events';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {expect, it} from 'vitest';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {BaseFunction, Root, globalFunctions} from '@ticlo/core';
import {createFileOAuthGrantStore, registerOAuth, routeOAuth, type OAuthGrant} from '@ticlo/oauth/node';
import type {HttpClient} from '@ticlo/core/functions/http/HttpClient.ts';
import {SecretCipher} from '@ticlo/node';
import {WsClientConnection} from '@ticlo/node/connect/WsClientConnection.ts';
import {createTicloApp} from '../server.ts';
import {startOAuthProvider} from './OAuthProvider.ts';

const session = (id = 'alice') => ({'X-Test-Session': id});

it('authorizes a deployment connection over the editor transport and refreshes it after disconnect', async () => {
  expect(globalFunctions.getDesc('auth:oauth')).toBeNull();
  registerOAuth();
  const desc = globalFunctions.getDesc('auth:oauth');
  registerOAuth();
  expect(globalFunctions.getDesc('auth:oauth')).toBe(desc);
  expect(() => globalFunctions.addUniqueFactory(BaseFunction, {name: 'oauth'}, 'auth')).toThrow(
    'A different implementation of auth:oauth is already registered'
  );
  expect(desc.properties).not.toContainEqual(expect.objectContaining({name: 'appOrigin'}));
  const provider = await startOAuthProvider();
  const root = new Root();
  const directory = await mkdtemp(join(tmpdir(), 'ticlo-oauth-'));
  const cipher = new SecretCipher(randomBytes(32));
  const disk = createFileOAuthGrantStore(directory, cipher);
  let grantKey: string;
  const app = new Hono();
  let connection: WsClientConnection;
  const server = serve({fetch: (request) => app.fetch(request), hostname: '127.0.0.1', port: 0});
  try {
    await once(server, 'listening');
    const address = server.address();
    if (typeof address !== 'object' || !address) throw new Error('Missing test server address');
    const origin = `http://127.0.0.1:${address.port}`;
    provider.clients.set('server-client', {redirectUri: `${origin}/oauth/callback/team`, secret: 'test-secret'});
    const registration = {
      authorizationUrl: `${provider.origin}/authorize`,
      tokenUrl: `${provider.origin}/token`,
      clientId: 'server-client',
      clientSecret: 'test-secret',
      resourceOrigin: provider.origin,
      scope: 'read',
    };
    let usedHandle: object;
    routeOAuth(app, root, {
      origin,
      connections: {team: registration},
      store: {
        get: disk.get,
        async set(key, grant) {
          grantKey = key;
          await disk.set(key, grant);
        },
      },
      authorize: (c) =>
        ['alice', 'bob'].includes(c.req.header('X-Test-Session')) ? c.req.header('X-Test-Session') : undefined,
      userGrant: async (c): Promise<OAuthGrant | undefined> => {
        usedHandle = c.get('ticloAuthContext');
        const user = c.req.header('X-Test-Session');
        return provider.access.has(user)
          ? {accessToken: user, scope: 'read', expiresAt: Date.now() + 60000}
          : undefined;
      },
    });
    const host = await createTicloApp({app, root, enableEditor: true});
    host.ticloWs.injectWebSocket(server);
    const flow = root.addFlow('oauth', {
      auth: {'#is': 'auth:oauth', 'source': 'connection', 'connection': 'team', 'scope': 'read'},
      client: {'#is': 'http:client', 'url': provider.origin, '~auth': '##.auth.#output'},
      userAuth: {'#is': 'auth:oauth', 'source': 'currentUser', 'connection': 'team', 'scope': 'read'},
      userClient: {'#is': 'http:client', 'url': provider.origin, '~auth': '##.userAuth.#output'},
      fetchMissingClient: {
        '#is': 'http:fetch',
        'url': provider.origin + '/resource',
        '~client': '##.missingHttpClient.#output',
      },
      plainClient: {'#is': 'http:client', 'url': provider.origin + '/api'},
      missing: {'#is': 'http:client', 'url': provider.origin, '~auth': '##.missingProfile.#output'},
    });
    root.runAll();
    const client = flow.queryValue('client.#output') as HttpClient;
    expect(flow.queryValue('fetchMissingClient.#emit')).toMatchObject({type: 'HTTP client unavailable'});
    const plainClient = flow.queryValue('plainClient.#output') as HttpClient;
    await expect(plainClient.request({url: provider.origin + '/api-v2'})).rejects.toThrow('outside the configured API');
    const userClient = flow.queryValue('userClient.#output') as HttpClient;
    await expect(client.request({url: '/resource'})).rejects.toHaveProperty('name', 'authorization-required');
    await expect((flow.queryValue('missing.#output') as HttpClient).request({url: '/resource'})).rejects.toHaveProperty(
      'name',
      'authorization-required'
    );
    connection = new WsClientConnection(origin.replace('http:', 'ws:') + '/ticlo', false);
    const {result} = await connection.executeCommand('oauth.auth', 'startAuthorization');
    await expect(
      connection.executeCommand('oauth.auth', 'completeAuthorization', {status: 'authorized'})
    ).rejects.toMatchObject({message: 'Authorization completion is server-only'});
    expect(flow.queryValue('auth.status')).toBe('authorization-link-ready');
    expect((await app.request(result.url)).status).toBe(403);
    expect((await app.request(result.url, {headers: session()})).status).toBe(200);
    const start = await app.request(result.url, {method: 'POST', headers: {...session(), Origin: origin}});
    expect(start.status).toBe(303);
    const allow = new URL(start.headers.get('location'));
    allow.searchParams.set('decision', 'allow');
    const callback = await fetch(allow, {redirect: 'manual'}).then((response) => response.headers.get('location'));
    expect((await app.request(callback, {headers: session('bob')})).status).toBe(403);
    expect((await app.request(callback, {headers: session()})).status).toBe(200);
    expect((await app.request(callback, {headers: session()})).status).toBe(400);
    expect(((await connection.executeCommand('oauth.auth', 'oauthStatus')) as any).result.status).toBe('authorized');
    connection.destroy();
    connection = undefined;

    expect((await client.request({url: '/resource'})).data).toEqual({user: 'server-client'});
    await expect(client.request({url: '/redirect'})).rejects.toThrow('OAuth HTTP request failed');
    await expect(client.request({url: `${origin}/resource`})).rejects.toThrow('outside the configured API');
    const persisted = await createFileOAuthGrantStore(directory, cipher).get(grantKey);
    await disk.set(grantKey, {...persisted, expiresAt: 0});
    await Promise.all([client.request({url: '/resource'}), client.request({url: '/resource'})]);
    expect(provider.refreshes).toBe(1);
    await disk.set(grantKey, {...persisted, expiresAt: 0});
    await expect(client.request({url: '/resource'})).rejects.toHaveProperty('name', 'authorization-required');
    expect(await disk.get(grantKey)).toBeUndefined();

    provider.access.set('alice', {user: 'alice', scope: 'read'});
    provider.access.set('bob', {user: 'bob', scope: 'read'});
    await expect(userClient.request({url: '/resource', authContext: {id: 'alice'}})).rejects.toHaveProperty(
      'name',
      'authorization-required'
    );

    root.addFlow('personalRoute', {
      route: {
        '#is': 'web-server:route',
        'path': '/whoami',
        'method': ['GET'],
        'contentType': ['empty'],
        '~server': '^web-server.#output',
      },
      handler: {
        '#is': 'handler',
        '~#call': '##.route.#emit',
        'use': {
          '#is': {
            '#is': '',
            '#inputs': {'#is': '', '#custom': [{name: 'authContext', type: 'object'}]},
            'fetch': {
              '#is': 'http:fetch',
              'url': '/resource',
              '~authContext': '##.#inputs.authContext',
              '~client': {
                '#is': 'http:client',
                'url': provider.origin,
                '~auth': {'#is': 'auth:oauth', 'source': 'currentUser', 'connection': 'team', 'scope': 'read'},
              },
            },
            '#outputs': {'#is': '', '~data': '##.fetch.#output', '~#wait': '##.fetch.#wait'},
          },
        },
      },
    });
    root.runAll();
    const responses = await Promise.all(
      ['alice', 'bob'].map(async (id) => {
        const response = await app.request('/api/whoami', {headers: session(id)});
        return response.json();
      })
    );
    expect(responses).toEqual([{user: 'alice'}, {user: 'bob'}]);
    expect(usedHandle).toBeDefined();
    await expect(userClient.request({url: '/resource', authContext: usedHandle})).rejects.toHaveProperty(
      'name',
      'authorization-required'
    );
  } finally {
    connection?.destroy();
    root.destroy();
    await Promise.all([
      provider.close(),
      new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
      rm(directory, {force: true, recursive: true}),
    ]);
  }
});
