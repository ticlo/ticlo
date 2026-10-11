import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {devUserAuth, routeRemoteStorage} from '@ticlo/file-server';
import {TicloFileClient} from '@ticlo/file-client';
import {FileOperations} from '../FileOperations.ts';

describe('File manager with the file server', () => {
  let directory: string;
  let client: TicloFileClient;
  let close: () => Promise<void>;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ticlo-file-manager-'));
    for (const project of ['demo', '#root']) {
      const path = join(directory, 'proj', project);
      await mkdir(path, {recursive: true});
      await writeFile(join(path, '_proj.json'), JSON.stringify({id: project}));
    }
    const app = new Hono();
    routeRemoteStorage(app, {rootDir: directory, authProvider: () => devUserAuth});
    await new Promise<void>((resolve) => {
      const server = serve({fetch: app.fetch, hostname: '127.0.0.1', port: 0}, (address) => {
        client = new TicloFileClient({baseURL: `http://127.0.0.1:${address.port}/file`});
        resolve();
      });
      close = () =>
        new Promise<void>((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose())));
    });
  });

  afterEach(async () => {
    await close?.();
    await rm(directory, {recursive: true, force: true});
  });

  const text = async (path: string) => new TextDecoder().decode((await client.getFile(path)).data);

  it('uploads, recursively copies, moves, renames, and deletes real files and empty folders', async () => {
    const operations = new FileOperations(client, 'demo');
    await operations.upload(
      [{path: 'src'}, {path: 'src/empty'}, {path: 'src/a.json', file: new File(['{"a":1}'], 'a.json')}],
      operations.root,
      async () => true
    );
    await operations.createFolder(operations.root, 'backup');
    const source = await client.getFileInfo('proj/demo/src');
    await operations.transfer([source], 'proj/demo/backup', false, async () => true);
    expect(await text('proj/demo/backup/src/a.json')).toBe('{"a":1}');
    expect(await client.getFileInfo('proj/demo/backup/src/empty')).toMatchObject({type: 'folder'});
    await operations.transfer(
      [await client.getFileInfo('proj/demo/backup/src')],
      'proj/demo/moved',
      true,
      async () => true
    );
    await operations.rename(await client.getFileInfo('proj/demo/moved/src/a.json'), 'b.json');
    expect(await text('proj/demo/moved/src/b.json')).toBe('{"a":1}');
    await operations.remove([await client.getFileInfo('proj/demo/moved')]);
    await expect(client.getFileInfo('proj/demo/moved')).rejects.toMatchObject({response: {status: 404}});
    expect(await text('proj/demo/src/a.json')).toBe('{"a":1}');
  });

  it('preserves declined conflicts, replaces approved files and folders, and names same-directory copies', async () => {
    const operations = new FileOperations(client, 'demo');
    await operations.upload([{path: 'a.txt', file: new File(['old'], 'a.txt')}], operations.root, async () => true);
    const replacement = [{path: 'a.txt', file: new File(['new'], 'a.txt')}];
    await operations.upload(replacement, operations.root, async () => false);
    expect(await text('proj/demo/a.txt')).toBe('old');
    await operations.upload(replacement, operations.root, async () => true);
    expect(await text('proj/demo/a.txt')).toBe('new');
    const source = await client.getFileInfo('proj/demo/a.txt');
    await operations.transfer([source], operations.root, false, async () => true);
    await operations.transfer([source], operations.root, false, async () => true);
    expect(await text('proj/demo/a (1).txt')).toBe('new');
    expect(await text('proj/demo/a (2).txt')).toBe('new');
    await operations.upload(
      [{path: 'dest'}, {path: 'dest/a.txt'}, {path: 'dest/a.txt/nested.txt', file: new File(['nested'], 'nested.txt')}],
      operations.root,
      async () => true
    );
    await operations.transfer([source], 'proj/demo/dest', false, async () => false);
    expect((await client.getFileInfo('proj/demo/dest/a.txt')).type).toBe('folder');
    await operations.transfer([source], 'proj/demo/dest', false, async () => true);
    expect(await text('proj/demo/dest/a.txt')).toBe('new');
  });

  it('handles #root and encoded filenames while refusing mutations outside that project', async () => {
    const operations = new FileOperations(client, '#root');
    const name = '#notes 你好.yaml';
    await operations.upload([{path: name, file: new File(['hello: world'], name)}], operations.root, async () => true);
    expect(await text(`proj/#root/${name}`)).toBe('hello: world');
    expect((await operations.list(operations.root)).map((entry) => entry.name)).toEqual([name]);
    await expect(operations.remove([await client.getFileInfo('proj/#root')])).rejects.toThrow('inside the project');
    await expect(
      operations.transfer([await client.getFileInfo(`proj/#root/${name}`)], 'proj/demo', true, async () => true)
    ).rejects.toThrow('inside the project');
    expect(await text(`proj/#root/${name}`)).toBe('hello: world');
  });
});
