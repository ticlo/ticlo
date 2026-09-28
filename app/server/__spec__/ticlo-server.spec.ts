import {expect, it} from 'vitest';
import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {serve} from '@hono/node-server';
import {Root, MemoryFlowStorage} from '@ticlo/core';
import {WsClientConnection} from '@ticlo/node/connect/WsClientConnection.ts';
import {AsyncClientPromise} from '@ticlo/core/connect/__spec__/AsyncClientPromise.ts';
import {FileServerFlowStorage, TicloFileClient} from '@ticlo/remote-storage';
import {createServerApp} from '../ticlo-server.ts';

it('serves files, runtime commands, WebSockets and flow routes on one port with scoped CORS', async () => {
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
  try {
    await once(server, 'listening');
    const address = server.address();
    if (typeof address !== 'object' || !address) throw new Error('Missing server address');
    const base = `http://127.0.0.1:${address.port}`;
    expect(await (await fetch(`${base}/health`)).json()).toEqual({status: 'ok'});
    expect(await (await fetch(base)).text()).toContain('/file');

    const preflight = await fetch(`${base}/file?op=upload`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3003',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,If-Match,If-None-Match',
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3003');
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('If-Match');
    expect(await readdir(join(dir, 'proj/#root'))).toEqual(['_proj.json']);
    const files = new TicloFileClient({baseURL: `${base}/file`});
    const remote = new Root();
    try {
      await remote.setStorage(new FileServerFlowStorage(files));
      await remote.start();
      expect(remote._globalRoot.save()).toEqual({'#is': ''});
      expect(await readdir(join(dir, 'proj/#root'))).toEqual(['_proj.json']);
    } finally {
      await remote.stop({discardChanges: true});
      remote.destroy();
    }
    await files.uploadFileResponse('proj/#root/download.txt', 'test fixture', {}, {headers: {'If-None-Match': '*'}});
    const fileUrl = `${base}/file/proj/%23root/download.txt`;
    const file = await fetch(fileUrl, {headers: {Origin: 'http://localhost:3003'}});
    expect(file.status).toBe(200);
    expect(file.headers.get('ETag')).toBeTruthy();
    expect(file.headers.get('Access-Control-Expose-Headers')).toContain('ETag');
    const deniedOrigin = await fetch(fileUrl, {headers: {Origin: 'https://untrusted.example'}});
    expect(deniedOrigin.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect((await files.readProject('#root')).id).toBe('#root');
    const upload = await files.uploadFileResponse(
      'proj/#root/check.txt',
      'stored',
      {},
      {headers: {'If-None-Match': '*'}}
    );
    await files.uploadFileResponse('proj/#root/check.txt', 'updated', {}, {headers: {'If-Match': upload.headers.etag}});
    expect(await (await fetch(`${base}/file/proj/%23root/check.txt`)).text()).toBe('updated');
    await expect(
      files.uploadFileResponse('proj/#root/check.txt', 'stale', {}, {headers: {'If-Match': upload.headers.etag}})
    ).rejects.toMatchObject({response: {status: 412}});

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
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({cmd: 'getFlowState', path: 'combinedServer'}),
    });
    expect(await response.json()).toEqual({state: 'enabled'});
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
    const project = join(dir, 'proj/#root');
    const metadata = '{"id":"#root","name":"My root","owner":"existing"}';
    await writeFile(join(project, '_proj.json'), metadata);
    const second = await createServerApp(dir);
    await second.app.request('/file?op=listProj');
    expect(await readFile(join(project, '_proj.json'), 'utf8')).toBe(metadata);
    await rm(join(project, '_proj.json'));
    const third = await createServerApp(dir);
    await third.app.request('/file?op=listProj');
    expect(await readdir(project)).toEqual([]);
  } finally {
    Root.instance._globalRoot.deleteValue('^local-server');
    await rm(dir, {recursive: true, force: true});
  }
});
