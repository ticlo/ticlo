import {afterEach, describe, expect, it} from 'vitest';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {routeRemoteStorage} from '@ticlo/file-server';
import {ScopedFileServerFiles} from '../ScopedFileServerFiles.ts';

describe('ScopedFileServerFiles', () => {
  let root: string;
  let close: () => Promise<void>;
  let files: ScopedFileServerFiles;

  afterEach(async () => {
    await files?.close();
    await close?.();
    if (root) await rm(root, {recursive: true, force: true});
  });

  it('uses the serv scope for files and Git without changing proj', async () => {
    root = await mkdtemp(join(tmpdir(), 'ticlo-scoped-files-'));
    const app = new Hono();
    routeRemoteStorage(app, {rootDir: root});
    await app.request('/file?op=createProj&scope=serv&name=main', {method: 'POST'});
    const baseURL = await new Promise<string>((resolve) => {
      const server = serve({fetch: app.fetch, hostname: '127.0.0.1', port: 0}, (address) => {
        resolve(`http://127.0.0.1:${address.port}/file`);
      });
      close = () => new Promise<void>((done) => server.close(() => done()));
    });
    files = new ScopedFileServerFiles(baseURL, 'serv');
    await files.createProject('other');
    expect((await files.listProjects()).map(({id}) => id)).toEqual(expect.arrayContaining(['main', 'other']));
    expect(await (await app.request('/file?op=listProj')).json()).toEqual([]);
    expect((await files.listFiles('')).map((entry) => entry.path)).toContain('main');
    await files.uploadFile('main/entry.ticlo', '{}');
    expect((await files.listFiles('main')).map((entry) => entry.path)).toContain('main/entry.ticlo');
    await files.initGit('main');
    expect((await files.getFileInfo('main/entry.ticlo')).gitStatus).toBe('added');
    const commit = await files.commitGit('main', 'Initial');
    expect((await files.getGitHistory('main'))[0].hash).toBe(commit.hash);
    expect((await app.request('/file?op=gitInfo&id=main')).status).toBe(404);
  });
});
