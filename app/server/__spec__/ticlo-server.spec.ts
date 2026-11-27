import {expect, it} from 'vitest';
import {cp, lstat, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {request} from 'node:http';
import {serve} from '@hono/node-server';
import type {Hono} from 'hono';
import {Root, MemoryFlowStorage, globalFunctions, type Block} from '@ticlo/core';
import {WsClientConnection} from '@ticlo/node/connect/WsClientConnection.ts';
import {AsyncClientPromise} from '@ticlo/core/connect/__spec__/AsyncClientPromise.ts';
import {ScopedFileServerFiles} from '@ticlo/remote-storage';
import {NodeStorage, SecretCipher} from '@ticlo/node';
import {bundledBrowserExamples} from '../examples.ts';
import {createServerApp, localOAuth} from '../ticlo-server.ts';

it('loads the OAuth Block without enabling the authorization routes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-oauth-disabled-'));
  const root = new Root();
  try {
    const {app} = await createServerApp(dir, undefined, root);
    expect((await app.request('/file?op=listProj')).ok).toBe(true);
    const desc = globalFunctions.getDesc('auth:oauth');
    expect(desc?.properties).toContainEqual(expect.objectContaining({name: 'clientId'}));
    expect(desc?.properties).toContainEqual(expect.objectContaining({name: '#secret', type: 'password'}));
    expect(desc?.commands.startAuthorization).toBeDefined();

    const flow = root.addFlow('oauth', {auth: {'#is': 'auth:oauth'}});
    root.runAll();
    expect(flow.queryValue('auth.status')).toBe('host-not-configured');
    const response = await app.request('/ticlo', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({cmd: 'executeCommand', path: 'oauth.auth', command: 'startAuthorization'}),
    });
    expect(await response.text()).toContain('OAuth routes are not configured on this host');
    expect((await app.request('/oauth/start/unused')).status).toBe(404);
  } finally {
    root.destroy();
    await rm(dir, {recursive: true, force: true});
  }
});

it('starts a local OAuth browser session on demand and rejects an untrusted origin', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-oauth-dev-'));
  const root = new Root();
  const origin = 'http://127.0.0.1:8010';
  const options = localOAuth(origin, dir, new SecretCipher(new Uint8Array(32)));
  try {
    const {app} = await createServerApp(dir, undefined, root, undefined, options);
    expect((await app.request(`${origin}/file?op=listProj`)).status).toBe(200);
    const untrusted = {Origin: 'https://example.test'};
    expect((await app.request(`${origin}/file?op=listProj`, {headers: untrusted})).status).toBe(403);
    expect((await app.request(`${origin}/api/missing`, {headers: untrusted})).status).toBe(404);
    const flow = root.addFlow('oauth', {
      auth: {
        '#is': 'auth:oauth',
        'connection': 'test',
        'authorizationUrl': 'https://provider.test/authorize',
        'tokenUrl': 'https://provider.test/token',
        'clientId': 'client',
        'requireClientSecret': true,
        'resourceOrigin': 'https://provider.test',
      },
    });
    root.runAll();
    const auth = flow.getValue('auth') as Block;
    expect(auth.getValue('status')).toBe('client-secret-required');
    auth.setValue('#secret', 'fixture');
    root.runAll();
    const call = (originHeader = 'http://localhost:5476') =>
      app.request(`${origin}/ticlo`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Origin': originHeader},
        body: JSON.stringify({cmd: 'callFunction', path: 'oauth.auth'}),
      });
    expect((await call(untrusted.Origin)).status).toBe(403);
    expect(auth.getValue('authorizationLink')).toBeUndefined();
    expect(await (await call()).text()).toBe('');
    const oldUrl = auth.getValue('authorizationLink') as string;
    expect(oldUrl).toMatch(/^http:\/\/127\.0\.0\.1:8010\/oauth\/start\//);
    expect(auth.getValue('status')).toBe('authorization-link-ready');
    expect(await (await call()).text()).toBe('');
    const url = auth.getValue('authorizationLink') as string;
    expect(url).not.toBe(oldUrl);
    const expired = await app.request(oldUrl);
    expect(expired.status).toBe(400);
    expect(expired.headers.has('Set-Cookie')).toBe(false);
    expect(flow.save().auth).not.toHaveProperty('authorizationLink');
    expect((await app.request(url, {headers: untrusted})).status).toBe(403);
    const redirect = await app.request(url);
    expect(redirect.status).toBe(303);
    const cookie = redirect.headers.get('Set-Cookie').split(';')[0];
    const authorization = new URL(redirect.headers.get('Location'));
    expect(authorization.searchParams.get('redirect_uri')).toBe(`${origin}/oauth/callback/test`);
    expect((await app.request(url, {headers: {Cookie: cookie}})).status).toBe(400);
    const callback = new URL(authorization.searchParams.get('redirect_uri'));
    callback.searchParams.set('state', authorization.searchParams.get('state'));
    callback.searchParams.set('error', 'access_denied');
    expect((await app.request(callback.href, {headers: {Cookie: `${cookie}invalid`}})).status).toBe(403);
    expect(auth.getValue('status')).toBe('authorization-pending');
    auth.setValue('#secret', undefined);
    root.runAll();
    expect(auth.getValue('status')).toBe('client-secret-required');
    expect(() => auth.executeCommand('startAuthorization', {})).toThrow('Set the OAuth Client Secret in #secret');
    expect((await app.request(callback.href, {headers: {Cookie: cookie}})).status).toBe(400);
  } finally {
    root.destroy();
    await rm(dir, {recursive: true, force: true});
  }
});

it('accepts WebSocket upgrades from the local Editor when OAuth is available', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-oauth-websocket-'));
  const root = new Root();
  let app: Hono;
  const server = serve({fetch: (req) => app.fetch(req), hostname: '127.0.0.1', port: 0});
  try {
    await once(server, 'listening');
    const address = server.address();
    if (typeof address !== 'object' || !address) throw new Error('Missing server address');
    const origin = `http://127.0.0.1:${address.port}`;
    const options = localOAuth(origin, dir, new SecretCipher(new Uint8Array(32)));
    const host = await createServerApp(dir, undefined, root, undefined, options);
    app = host.app;
    host.ticloWs.injectWebSocket(server);
    expect((await fetch(`${origin}/file?op=listProj`)).ok).toBe(true);

    const upgrade = (editorOrigin: string, target = origin) =>
      new Promise<number>((resolve, reject) => {
        const req = request(`${target}/ticlo`, {
          headers: {
            'Origin': editorOrigin,
            'Connection': 'Upgrade',
            'Upgrade': 'websocket',
            'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
            'Sec-WebSocket-Version': '13',
          },
        });
        req.on('upgrade', (res, socket) => {
          socket.destroy();
          resolve(res.statusCode);
        });
        req.on('response', (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        req.on('error', reject);
        req.end();
      });

    expect(await upgrade('http://localhost:5476')).toBe(101);
    expect(await upgrade('http://127.0.0.1:5476', `http://localhost:${address.port}`)).toBe(101);
    expect(await upgrade('https://example.test')).toBe(403);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    root.destroy();
    await rm(dir, {recursive: true, force: true});
  }
});

it('serves files, runtime commands, WebSockets and flow routes on one port with open CORS', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-server-'));
  const root = new Root();
  const storage = new MemoryFlowStorage();
  storage.saveFlow(
    null,
    {
      '#is': '',
      'service': {'#is': 'add', 0: 1, 1: 2},
      '^web-server': {'#is': 'add', '#output': 'saved override', 'note': 'saved extension'},
    },
    '#global'
  );
  const {app, ticloWs} = await createServerApp(dir, undefined, root);
  await root.setStorage(storage);
  expect(root.queryValue('#global.service.#output')).toBeUndefined();
  await root.start();
  const server = serve({fetch: app.fetch, hostname: '127.0.0.1', port: 0});
  ticloWs.injectWebSocket(server);
  const callbacks = new AsyncClientPromise();
  let client: WsClientConnection;
  let files: ScopedFileServerFiles;
  try {
    await once(server, 'listening');
    const address = server.address();
    if (typeof address !== 'object' || !address) throw new Error('Missing server address');
    const base = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${base}/health`, {headers: {Origin: 'https://example.com'}});
    expect(await health.json()).toEqual({status: 'ok'});
    expect(health.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await (await fetch(base)).text()).toContain('/file');
    expect(await (await fetch(`${base}/file?op=user`)).json()).toEqual({id: 'admin'});
    expect((await fetch(`${base}/file/usr/another-user/private.txt`)).status).toBe(403);

    const preflight = await fetch(`${base}/file?op=upload`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,If-Match,If-None-Match',
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('If-Match');
    files = new ScopedFileServerFiles(`${base}/file`, 'serv');
    await files.uploadFile('#root/download.txt', 'test fixture', {revision: null});
    const fileUrl = `${base}/file/serv/%23root/download.txt`;
    const file = await fetch(fileUrl, {headers: {Origin: 'https://example.com'}});
    expect(file.status).toBe(200);
    expect(file.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(file.headers.get('ETag')).toBeTruthy();
    expect(file.headers.get('Access-Control-Expose-Headers')).toContain('ETag');
    const upload = await files.uploadFile('#root/check.txt', 'stored', {revision: null});
    await files.uploadFile('#root/check.txt', 'updated', {revision: upload.revision});
    expect(await (await fetch(`${base}/file/serv/%23root/check.txt`)).text()).toBe('updated');
    await expect(files.uploadFile('#root/check.txt', 'stale', {revision: upload.revision})).rejects.toMatchObject({
      code: 'conflict',
    });

    const flow = root.addFlow('combinedServer', {
      value: 42,
      route: {
        '#is': 'web-server:route',
        'path': '/combined',
        'method': ['GET'],
        'contentType': ['empty'],
        '~server': '^web-server.#output',
      },
    });
    root.runAll();
    const response = await fetch(`${base}/ticlo`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Origin': 'https://example.com'},
      body: JSON.stringify({cmd: 'getFlowState', path: 'combinedServer'}),
    });
    expect(await response.json()).toEqual({state: 'enabled'});
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    client = new WsClientConnection(`ws://127.0.0.1:${address.port}/ticlo`, false);
    client.subscribe('combinedServer.value', callbacks);
    expect((await callbacks.promise).cache.value).toBe(42);
    expect((await client.getValue('#global.^web-server.#is')).value).toBe('web-server:server');
    expect((await client.getValue('#global.^web-server.note')).value).toBe('saved extension');
    const updated = callbacks.promise;
    flow.setValue('value', 43);
    expect((await updated).cache.value).toBe(43);

    // A registered route without a task handler returns 501, rather than the router's 404.
    expect((await fetch(`${base}/api/combined`)).status).toBe(501);
    expect((await fetch(`${base}/api/missing`)).status).toBe(404);
    expect(root.queryValue('#global.service.#output')).toBe(3);
  } finally {
    callbacks.cancel();
    client?.destroy();
    await files?.close();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await root.stop({discardChanges: true});
    root.destroy();
    await rm(dir, {recursive: true, force: true});
  }
});

it('leaves existing root projects unchanged, including projects without metadata', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-existing-root-'));
  const root = new Root();
  try {
    const first = await createServerApp(dir, undefined, root);
    await first.app.request('/file?op=listProj');
    const project = join(dir, 'serv/#root');
    const metadata = '{"id":"#root","name":"My root","owner":"existing"}';
    await writeFile(join(project, '.proj'), metadata);
    const second = await createServerApp(dir, undefined, root);
    await second.app.request('/file?op=listProj');
    expect(await readFile(join(project, '.proj'), 'utf8')).toBe(metadata);
    await rm(join(project, '.proj'));
    const third = await createServerApp(dir, undefined, root);
    await third.app.request('/file?op=listProj');
    expect(await readdir(project)).toEqual([]);
  } finally {
    root.destroy();
    await rm(dir, {recursive: true, force: true});
  }
});

it('serves project Git operations from the installed file server', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-git-server-'));
  const root = new Root();
  try {
    const {app} = await createServerApp(dir, undefined, root);
    const info = await app.request('/file?op=gitInfo&scope=serv&id=%23root');
    expect(await info.json()).toEqual({initialized: false});
    const initialized = await app.request('/file?op=gitInit&scope=serv&id=%23root', {method: 'POST'});
    expect(initialized.status).toBe(200);
    expect((await initialized.json()).branch).toBe('main');
  } finally {
    root.destroy();
    await rm(dir, {recursive: true, force: true});
  }
});

it('serves linked browser examples separately from Node.js examples', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-server-examples-'));
  const root = new Root();
  try {
    const source = join(dir, 'bundled');
    await cp(bundledBrowserExamples, source, {recursive: true});
    const {app} = await createServerApp(dir, undefined, root, source);
    const browserProject = join(dir, 'proj/examples');
    const nodeProject = join(dir, 'serv/examples');
    const nodeOAuthFlow = join(nodeProject, 'oauth/google-drive.ticlo');
    expect(await realpath(browserProject)).toBe(await realpath(source));
    expect((await lstat(nodeProject)).isDirectory()).toBe(true);
    expect(JSON.parse(await readFile(nodeOAuthFlow, 'utf8')).googleDriveAuth).toMatchObject({
      '#is': 'auth:oauth',
      'source': 'server',
      'connection': 'google-drive',
      '@b-widget': 'web-authorization',
    });

    const browserCatalog = await app.request('/file?op=listProj&scope=proj');
    expect(await browserCatalog.json()).toContainEqual({id: 'examples'});
    const nodeCatalog = await app.request('/file?op=listProj&scope=serv');
    expect(await nodeCatalog.json()).toContainEqual({id: 'examples', name: 'Examples'});

    await root.setStorage(new NodeStorage(join(dir, 'serv')));
    await root.start();
    expect(root.queryValue('+examples.large-table')).toBeUndefined();
    await root.enableLibrary('examples', {flows: ['large-table']});
    const rows = root.queryValue('+examples.large-table.table.rows') as Record<string, unknown>[];
    expect(rows).toHaveLength(100_000);
    expect(rows[0]).toMatchObject({id: 1, firstRow: 'First row'});
    expect(rows.at(-1)).toMatchObject({id: 100_000, lastRow: 'Last row'});

    const flow = 'layout/horizontal.ticlo';
    const edited = '{"#is":"","note":"Edited example"}';
    const upload = await app.request(`/file?op=upload&path=proj/examples/${flow}`, {
      method: 'POST',
      body: edited,
    });
    expect(upload.ok).toBe(true);
    const nodeFlow = join(nodeProject, 'large-table.ticlo');
    await writeFile(nodeFlow, edited);
    await writeFile(nodeOAuthFlow, edited);
    const {app: restarted} = await createServerApp(dir, undefined, root, source);
    expect(await readFile(join(source, flow), 'utf8')).toBe(edited);
    expect(await readFile(nodeFlow, 'utf8')).toBe(edited);
    expect(await readFile(nodeOAuthFlow, 'utf8')).toBe(edited);
    expect((await restarted.request(`/file/serv/examples/${flow}`)).status).toBe(404);
    expect((await restarted.request('/file/proj/examples/large-table.ticlo')).status).toBe(404);

    await symlink(dir, join(source, 'outside'), 'dir');
    expect((await restarted.request(`/file/proj/examples/outside/bundled/${flow}`)).status).toBe(403);
  } finally {
    await root.stop({discardChanges: true});
    root.destroy();
    await rm(dir, {recursive: true, force: true});
  }
});

it('supports backend-only mode with enableFrontend: false', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-server-backend-only-'));
  const root = new Root();
  try {
    const {app} = await createServerApp(dir, undefined, root, undefined, {enableFrontend: false});
    expect(await readdir(dir)).not.toContain('proj');
    expect((await app.request('/file?op=listProj&scope=proj')).status).toBe(404);
    expect((await app.request('/file/proj/%23root/hello.txt')).status).toBe(404);

    const serverCatalog = await app.request('/file?op=listProj&scope=serv');
    expect(serverCatalog.status).toBe(200);
    expect(await serverCatalog.json()).toEqual(expect.arrayContaining([expect.objectContaining({id: '#root'})]));
  } finally {
    root.destroy();
    await rm(dir, {recursive: true, force: true});
  }
});
