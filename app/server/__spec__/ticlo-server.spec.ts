import {expect, it} from 'vitest';
import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {serve} from '@hono/node-server';
import {Root, MemoryFlowStorage} from '@ticlo/core';
import {WsClientConnection} from '@ticlo/node/connect/WsClientConnection.ts';
import {AsyncClientPromise} from '@ticlo/core/connect/__spec__/AsyncClientPromise.ts';
import {ScopedFileServerFiles} from '@ticlo/remote-storage';
import {createServerApp} from '../ticlo-server.ts';

it('serves files, runtime commands, WebSockets and flow routes on one port with open CORS', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-server-'));
  const root = Root.instance;
  const storage = new MemoryFlowStorage();
  storage.saveFlow(null, {'#is': '', 'dormant': {'#is': 'add', 0: 1, 1: 2}}, '#global');
  await root.setStorage(storage);
  await root.start();
  const {app, ticloWs} = await createServerApp(dir);
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
        '~server': '^local-server.#output',
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
    const updated = callbacks.promise;
    flow.setValue('value', 43);
    expect((await updated).cache.value).toBe(43);

    // A registered route without a task handler returns 501, rather than the router's 404.
    expect((await fetch(`${base}/api/combined`)).status).toBe(501);
    expect((await fetch(`${base}/api/missing`)).status).toBe(404);
    expect(root.queryValue('#global.dormant.#output')).toBeUndefined();
  } finally {
    callbacks.cancel();
    client?.destroy();
    await files?.close();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await root.stop({discardChanges: true});
    root._globalRoot.deleteValue('^local-server');
    await rm(dir, {recursive: true, force: true});
  }
});

it('leaves existing root projects unchanged, including projects without metadata', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-existing-root-'));
  try {
    const first = await createServerApp(dir);
    await first.app.request('/file?op=listProj');
    const project = join(dir, 'serv/#root');
    const metadata = '{"id":"#root","name":"My root","owner":"existing"}';
    await writeFile(join(project, '.proj'), metadata);
    const second = await createServerApp(dir);
    await second.app.request('/file?op=listProj');
    expect(await readFile(join(project, '.proj'), 'utf8')).toBe(metadata);
    await rm(join(project, '.proj'));
    const third = await createServerApp(dir);
    await third.app.request('/file?op=listProj');
    expect(await readdir(project)).toEqual([]);
  } finally {
    Root.instance._globalRoot.deleteValue('^local-server');
    await rm(dir, {recursive: true, force: true});
  }
});

it('serves project Git operations from the installed file server', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-git-server-'));
  try {
    const {app} = await createServerApp(dir);
    const info = await app.request('/file?op=gitInfo&scope=serv&id=%23root');
    expect(await info.json()).toEqual({initialized: false});
    const initialized = await app.request('/file?op=gitInit&scope=serv&id=%23root', {method: 'POST'});
    expect(initialized.status).toBe(200);
    expect((await initialized.json()).branch).toBe('main');
  } finally {
    Root.instance._globalRoot.deleteValue('^local-server');
    await rm(dir, {recursive: true, force: true});
  }
});
