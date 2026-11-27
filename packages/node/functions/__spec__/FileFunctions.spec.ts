import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {DoneEvent, ErrorEvent, Root, type Block} from '@ticlo/core';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {routeFileStorage} from '@ticlo/web-server/file-storage.ts';
import {RemoteStorage} from '@ticlo/remote-storage';
import {NodeStorage} from '../../storage/NodeStorage.ts';

async function triggerAndWait(root: Root, block: Block) {
  block.getProperty('#emit').updateValue(undefined);
  block.setValue('#call', {});
  root._run();
  await shouldHappen(() => {
    const val = block.getValue('#emit');
    return val instanceof DoneEvent || val instanceof ErrorEvent;
  });
  const emitted = block.getValue('#emit');
  if (emitted instanceof ErrorEvent) {
    throw new Error(`Block ${block._blockId} failed: ${emitted.detail ?? emitted.type}`);
  }
  expect(emitted).toBeInstanceOf(DoneEvent);
}

describe('file:* function blocks with NodeStorage and RemoteStorage', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ticlo-file-fns-'));
    await mkdir(join(dir, 'serv/proj1'), {recursive: true});
    await mkdir(join(dir, 'proj/#root'), {recursive: true});
    await mkdir(join(dir, 'proj/proj1'), {recursive: true});
    await mkdir(join(dir, 'proj/web'), {recursive: true});
  });

  afterEach(async () => {
    await rm(dir, {recursive: true, force: true});
  });

  it('executes full read/list/info/write/mkdir/copy/move/rename/delete lifecycle on NodeStorage including ++frontend', async () => {
    const storage = new NodeStorage(join(dir, 'serv'), {
      fileBaseUrl: 'http://127.0.0.1:8010/file',
      fileUrlScope: 'serv',
      frontendDir: join(dir, 'proj'),
      frontendUrlScope: 'proj',
    });
    await writeFile(join(dir, 'serv/proj1/config.json'), JSON.stringify({port: 8010}));
    await writeFile(join(dir, 'proj/web/logo.bin'), new Uint8Array([1, 2, 3, 4]));

    const root = new Root();
    try {
      await root.setStorage(storage);
      await root.start();
      const flow = root.addFlow('+proj1.main', undefined, undefined, true);

      // file:mkdir + file:write
      const mk = flow.createBlock('mk');
      mk.setValue('#is', 'file:mkdir');
      mk.setValue('path', '+/docs/nested');
      await triggerAndWait(root, mk);

      const writer = flow.createBlock('writer');
      writer.setValue('#is', 'file:write');
      writer.setValue('path', '+/docs/nested/note.txt');
      writer.setValue('data', 'hello ticlo');
      await triggerAndWait(root, writer);
      expect(typeof writer.getValue('#output')).toBe('string');

      // file:write existsBehavior=fail fails when overwriting
      writer.setValue('existsBehavior', 'fail');
      writer.setValue('#emit', undefined);
      writer.setValue('#call', {});
      root._run();
      await shouldHappen(() => writer.getValue('#emit') instanceof ErrorEvent);

      // file:read (json + binary across ++web)
      const readJson = flow.createBlock('readJson');
      readJson.setValue('#is', 'file:read');
      readJson.setValue('format', 'json');
      readJson.setValue('path', '+/config.json');
      await shouldHappen(() => readJson.getValue('#output') !== undefined);
      expect(readJson.getValue('#output')).toEqual({port: 8010});

      const readBin = flow.createBlock('readBin');
      readBin.setValue('#is', 'file:read');
      readBin.setValue('format', 'binary');
      readBin.setValue('path', '++web/logo.bin');
      await shouldHappen(() => readBin.getValue('#output') !== undefined);
      expect(readBin.getValue('#output')).toEqual(new Uint8Array([1, 2, 3, 4]));

      // file:info + file:list
      const info = flow.createBlock('info');
      info.setValue('#is', 'file:info');
      info.setValue('path', '+/docs/nested/note.txt');
      await shouldHappen(() => info.getValue('exists') === true);
      expect(info.getValue('#output')).toMatchObject({type: 'file', size: 11});

      const listFrontend = flow.createBlock('listFrontend');
      listFrontend.setValue('#is', 'file:list');
      listFrontend.setValue('path', '++web');
      await shouldHappen(() => Array.isArray(listFrontend.getValue('#output')));
      expect((listFrontend.getValue('#output') as {name: string}[]).map((e) => e.name)).toContain('logo.bin');

      // file:copy (including cross-storage to ++web), file:rename, file:move, file:delete
      const copier = flow.createBlock('copier');
      copier.setValue('#is', 'file:copy');
      copier.setValue('source', '+/docs/nested/note.txt');
      copier.setValue('destination', '++web/note-copy.txt');
      await triggerAndWait(root, copier);

      const readCopy = flow.createBlock('readCopy');
      readCopy.setValue('#is', 'file:read');
      readCopy.setValue('path', '++web/note-copy.txt');
      await shouldHappen(() => readCopy.getValue('#output') === 'hello ticlo');

      const renamer = flow.createBlock('renamer');
      renamer.setValue('#is', 'file:rename');
      renamer.setValue('path', '+/docs/nested/note.txt');
      renamer.setValue('name', 'renamed.txt');
      await triggerAndWait(root, renamer);

      const mover = flow.createBlock('mover');
      mover.setValue('#is', 'file:move');
      mover.setValue('source', '+/docs/nested/renamed.txt');
      mover.setValue('destination', '+/docs/moved.txt');
      await triggerAndWait(root, mover);

      info.setValue('path', '+/docs/moved.txt');
      await shouldHappen(() => (info.getValue('#output') as {name?: string} | undefined)?.name === 'moved.txt');

      const deleter = flow.createBlock('deleter');
      deleter.setValue('#is', 'file:delete');
      deleter.setValue('path', '+/docs/moved.txt');
      await triggerAndWait(root, deleter);

      await shouldHappen(async () => {
        info.setValue('path', '+/docs/moved.txt');
        info.setValue('#call', {});
        root._run();
        await Promise.resolve();
        return info.getValue('exists') === false;
      });
    } finally {
      await root.stop({discardChanges: true});
      root.destroy();
    }
  });

  it('operates over HTTP against file-server via RemoteStorage', async () => {
    const app = new Hono();
    routeFileStorage(app, {rootDir: dir});
    const server = serve({fetch: app.fetch, hostname: '127.0.0.1', port: 0});
    const root = new Root();
    let remote: RemoteStorage | undefined;
    try {
      await once(server, 'listening');
      const address = server.address();
      if (typeof address !== 'object' || !address) throw new Error('Missing server address');
      remote = new RemoteStorage({baseURL: `http://127.0.0.1:${address.port}/file`});

      await root.setStorage(remote);
      await root.start();
      const flow = root.addFlow('+proj1.main', undefined, undefined, true);

      const writer = flow.createBlock('writer');
      writer.setValue('#is', 'file:write');
      writer.setValue('path', '+/hello.json');
      writer.setValue('data', {ok: true});
      await triggerAndWait(root, writer);

      const read = flow.createBlock('read');
      read.setValue('#is', 'file:read');
      read.setValue('format', 'json');
      read.setValue('path', '+/hello.json');
      await shouldHappen(() => read.getValue('#output') !== undefined);
      expect(read.getValue('#output')).toEqual({ok: true});

      const list = flow.createBlock('list');
      list.setValue('#is', 'file:list');
      list.setValue('path', '+/');
      await shouldHappen(() => Array.isArray(list.getValue('#output')));
      expect((list.getValue('#output') as {name: string}[]).map((e) => e.name)).toContain('hello.json');

      const renamer = flow.createBlock('renamer');
      renamer.setValue('#is', 'file:rename');
      renamer.setValue('path', '+/hello.json');
      renamer.setValue('name', 'renamed.json');
      await triggerAndWait(root, renamer);

      const deleter = flow.createBlock('deleter');
      deleter.setValue('#is', 'file:delete');
      deleter.setValue('path', '+/renamed.json');
      await triggerAndWait(root, deleter);
    } finally {
      await root.stop({discardChanges: true});
      root.destroy();
      await remote?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
