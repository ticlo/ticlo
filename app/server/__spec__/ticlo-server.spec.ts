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
import {NodeStorage} from '@ticlo/node';
import {createServerApp} from '../ticlo-server.ts';

it('serves files, runtime commands, WebSockets and flow routes on one port with open CORS', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-server-'));
  const root = new Root();
  const storage = new MemoryFlowStorage();
  storage.saveFlow(
    null,
    {
      '#is': '',
      'dormant': {'#is': 'add', 0: 1, 1: 2},
      '^web-server': {'#is': 'add', '#output': 'saved override', 'note': 'saved extension'},
    },
    '#global'
  );
  const {app, ticloWs} = await createServerApp(dir, undefined, root);
  await root.setStorage(storage);
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
    expect(root.queryValue('#global.dormant.#output')).toBeUndefined();
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

it('seeds a large table in the server examples project and preserves edits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ticlo-server-examples-'));
  const root = new Root();
  try {
    const {app} = await createServerApp(dir, undefined, root);
    const catalog = await app.request('/file?op=listProj&scope=serv');
    expect(await catalog.json()).toContainEqual({id: 'examples', name: 'Examples'});
    await root.setStorage(new NodeStorage(join(dir, 'serv')));
    await root.start();
    expect(root.queryValue('+examples.large-table')).toBeUndefined();
    await root.enableLibrary('examples', {flows: ['large-table']});
    const rows = root.queryValue('+examples.large-table.table.rows') as Record<string, unknown>[];
    expect(rows).toHaveLength(100_000);
    expect(rows[0]).toMatchObject({id: 1, firstRow: 'First row'});
    expect(rows.at(-1)).toMatchObject({id: 100_000, lastRow: 'Last row'});

    const project = join(dir, 'serv/examples');
    const edited = '{"#is":"","note":"Edited example"}';
    await writeFile(join(project, 'large-table.ticlo'), edited);
    await writeFile(join(project, '.proj'), '{"id":"examples","name":"My examples"}');
    await createServerApp(dir, undefined, root);
    expect(await readFile(join(project, 'large-table.ticlo'), 'utf8')).toBe(edited);
    expect(JSON.parse(await readFile(join(project, '.proj'), 'utf8')).name).toBe('My examples');
  } finally {
    await root.stop({discardChanges: true});
    root.destroy();
    await rm(dir, {recursive: true, force: true});
  }
});
