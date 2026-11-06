import {mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import AdmZip from 'adm-zip';
import {Hono} from 'hono';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {routeRemoteStorage} from '@ticlo/file-server';

describe('project Git API', () => {
  let root: string;
  let app: Hono;
  let user = 'alice';

  const request = async (method: 'GET' | 'POST', op: string, query: Record<string, string>, body?: string) =>
    app.request(`/file?${new URLSearchParams({op, ...query})}`, {method, body});

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ticlo-git-'));
    await mkdir(join(root, 'proj/main'), {recursive: true});
    await writeFile(join(root, 'proj/main/.proj'), JSON.stringify({id: 'main', name: 'Main'}));
    await writeFile(join(root, 'proj/main/a.txt'), 'initial');
    user = 'alice';
    app = new Hono();
    routeRemoteStorage(app, {
      rootDir: root,
      authProvider: () => ({
        getUserId: () => user,
        getUserEmail: () => (user === 'alice' ? 'alice@example.com' : undefined),
        canRead: () => true,
        canWrite: () => true,
      }),
    });
  });

  afterEach(async () => rm(root, {recursive: true, force: true}));

  it('returns the authenticated user ID', async () => {
    expect(await request('GET', 'user', {}).then((response) => response.json())).toEqual({id: 'alice'});
  });

  it('migrates old metadata on startup', async () => {
    await request('GET', 'gitInfo', {id: 'main'});
    await rm(join(root, 'proj/main/.proj'));
    await writeFile(join(root, 'proj/main/_proj.json'), JSON.stringify({id: 'main', name: 'Old'}));
    const restarted = new Hono();
    routeRemoteStorage(restarted, {rootDir: root});
    await restarted.request('/file?op=gitInfo&id=main');
    const response = await restarted.request('/file?op=readProj&id=main');
    expect(response.status).toBe(200);
    expect((await response.json()).name).toBe('Old');
    expect(await readdir(join(root, 'proj/main'))).toContain('.proj');
    expect(await readdir(join(root, 'proj/main'))).not.toContain('_proj.json');
  });

  it('allows creating a project root while protecting destructive root operations', async () => {
    expect((await request('POST', 'mkdir', {path: 'proj/another'})).status).toBe(204);
    expect((await request('POST', 'upload', {path: 'proj/another/.proj'}, '{"id":"another"}')).status).toBe(403);
    expect((await request('POST', 'delete', {path: 'proj/another'})).status).toBe(403);
    expect(await request('GET', 'listProj', {}).then((response) => response.json())).not.toEqual(
      expect.arrayContaining([expect.objectContaining({id: 'another'})])
    );
  });

  it('hides dotfiles from listings while allowing other dotfiles to change', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    const list = () => request('GET', 'list', {path: 'proj/main'}).then((response) => response.json());
    expect((await list()).map((entry: {name: string}) => entry.name)).not.toEqual(
      expect.arrayContaining(['.proj', '.gitignore', '.gitlog'])
    );
    for (const name of ['.proj', '.gitignore', '.gitlog']) {
      expect((await request('GET', 'get', {path: `proj/main/${name}`})).status).toBe(200);
      expect((await request('POST', 'upload', {path: `proj/main/${name}`}, 'bad')).status).toBe(403);
      expect((await request('POST', 'delete', {path: `proj/main/${name}`})).status).toBe(403);
      expect((await request('POST', 'move', {path: `proj/main/${name}`, dest: `proj/main/${name}.old`})).status).toBe(
        403
      );
    }

    expect((await request('POST', 'upload', {path: 'proj/main/.gitkeep'}, 'first')).status).toBe(200);
    expect((await request('POST', 'upload', {path: 'proj/main/.gitkeep'}, 'second')).status).toBe(200);
    expect((await request('GET', 'get', {path: 'proj/main/.gitkeep'})).status).toBe(200);
    expect((await list()).some((entry: {name: string}) => entry.name === '.gitkeep')).toBe(false);
    expect((await request('POST', 'move', {path: 'proj/main/.gitkeep', dest: 'proj/main/.hidden'})).status).toBe(204);
    expect((await request('POST', 'delete', {path: 'proj/main/.hidden'})).status).toBe(204);
  });

  it('exports only .proj among dotfiles and imports both metadata formats', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await writeFile(join(root, 'proj/main/.gitkeep'), 'keep');
    await writeFile(join(root, 'proj/main/.hidden'), 'hidden');
    const exported = await request('GET', 'exportProj', {id: 'main'});
    expect(exported.status).toBe(200);
    const archive = new AdmZip(Buffer.from(await exported.arrayBuffer()));
    const names = archive.getEntries().map((entry) => entry.entryName);
    expect(names).toContain('main/.proj');
    expect(names).toContain('main/a.txt');
    expect(names).not.toEqual(
      expect.arrayContaining(['main/.gitignore', 'main/.gitlog', 'main/.gitkeep', 'main/.hidden'])
    );

    for (const filename of ['.proj', '_proj.json']) {
      const projectId = filename === '.proj' ? 'newformat' : 'oldformat';
      const input = new AdmZip();
      input.addFile(filename, Buffer.from(JSON.stringify({id: projectId, name: projectId})));
      input.addFile('file.txt', Buffer.from('imported'));
      const imported = await app.request('/file?op=importProj', {
        method: 'POST',
        body: new Uint8Array(input.toBuffer()),
      });
      expect(imported.status).toBe(200);
      expect(await readFile(join(root, `proj/${projectId}/.proj`), 'utf8')).toContain(projectId);
      expect(await readFile(join(root, `proj/${projectId}/file.txt`), 'utf8')).toBe('imported');
      expect(await readdir(join(root, `proj/${projectId}`))).not.toContain('_proj.json');
    }
  });

  it('shows unstaged status, protects internal files, and commits the log with its author', async () => {
    expect((await request('POST', 'gitInit', {id: 'main'})).status).toBe(200);
    expect((await request('GET', 'gitInfo', {id: 'main'}).then((response) => response.json())).branch).toBe('main');
    expect(
      (await request('GET', 'list', {path: 'proj/main'}).then((response) => response.json())).find(
        (entry: {name: string}) => entry.name === 'a.txt'
      ).gitStatus
    ).toBe('added');
    expect((await request('POST', 'upload', {path: 'proj/main/.gitlog'}, 'bad')).status).toBe(403);
    expect((await request('POST', 'delete', {path: 'proj/main/.gitignore'})).status).toBe(403);
    expect((await request('POST', 'move', {path: 'proj/main/.gitlog', dest: 'proj/main/log.txt'})).status).toBe(403);
    expect((await request('GET', 'get', {path: 'proj/main/.git/config'})).status).toBe(403);
    expect((await request('GET', 'get', {path: 'proj/main/.gitignore'})).status).toBe(200);
    await symlink('.gitignore', join(root, 'proj/main/alias'));
    expect((await request('GET', 'get', {path: 'proj/main/alias'})).status).toBe(403);

    expect((await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: ''}))).status).toBe(200);
    expect((await request('POST', 'upload', {path: 'proj/main/a.txt'}, 'first edit')).status).toBe(200);
    expect((await request('POST', 'upload', {path: 'proj/main/a.txt'}, 'second edit')).status).toBe(200);
    expect((await request('POST', 'upload', {path: 'proj/main/name,"quoted".txt'}, 'quoted')).status).toBe(200);
    expect(
      (await request('POST', 'move', {path: 'proj/main/name,"quoted".txt', dest: 'proj/main/renamed.txt'})).status
    ).toBe(204);
    expect((await request('POST', 'updateProj', {id: 'main'}, JSON.stringify({name: 'Renamed'}))).status).toBe(200);
    const log = (await readFile(join(root, 'proj/main/.gitlog'), 'utf8')).trim().split('\n');
    expect(log.filter((line) => line.endsWith(',edit,a.txt'))).toHaveLength(1);
    expect(log.some((line) => line.endsWith(',edit,.proj'))).toBe(true);
    expect(log[0]).toContain(',alice <alice@example.com>,');
    expect(log.some((line) => line.endsWith(',create,"name,""quoted"".txt"'))).toBe(true);
    expect(log.some((line) => line.endsWith(',move,"name,""quoted"".txt -> renamed.txt"'))).toBe(true);

    await writeFile(join(root, 'proj/main/external.txt'), 'without API');
    const listing = await request('GET', 'list', {path: 'proj/main'}).then((response) => response.json());
    expect(listing.find((entry: {name: string}) => entry.name === 'a.txt').gitStatus).toBe('modified');
    expect(listing.find((entry: {name: string}) => entry.name === 'external.txt').gitStatus).toBe('added');

    user = 'bob';
    const committed = await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'User note'}));
    expect(committed.status).toBe(200);
    expect(await committed.json()).toMatchObject({author: 'alice', email: 'alice@example.com'});
    expect(await readFile(join(root, 'proj/main/.gitlog'), 'utf8')).toBe('');
    expect(
      (await request('GET', 'info', {path: 'proj/main'}).then((response) => response.json())).gitStatus
    ).toBeUndefined();
    const history = await request('GET', 'gitHistory', {id: 'main'}).then((response) => response.json());
    expect(history[0].message).toContain('--- --- ---');
    expect(history[0].message.match(/User note/g)).toHaveLength(1);
    expect(history[0].message).toContain(',alice <alice@example.com>,edit,a.txt');
    expect(history[0].message).toContain(',create,"name,""quoted"".txt"');
    expect(
      (await request('GET', 'list', {path: 'proj/main'}).then((response) => response.json())).find(
        (entry: {name: string}) => entry.name === 'a.txt'
      ).gitStatus
    ).toBeUndefined();

    await writeFile(join(root, 'proj/main/without-log.txt'), 'direct change');
    const fallback = await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: ''}));
    expect(await fallback.json()).toMatchObject({author: 'bob', email: 'bob@ticlo.app'});
  });

  it('shows deleted files and forks history, pending changes, and empty directories', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Initial'}));
    await request('POST', 'delete', {path: 'proj/main/a.txt'});
    await request('POST', 'mkdir', {path: 'proj/main/empty'});
    await request('POST', 'upload', {path: 'proj/main/pending.txt'}, 'pending');

    const listing = await request('GET', 'list', {path: 'proj/main'}).then((response) => response.json());
    expect(listing.find((entry: {name: string}) => entry.name === 'a.txt').gitStatus).toBe('deleted');
    expect(
      (await request('GET', 'info', {path: 'proj/main/a.txt'}).then((response) => response.json())).gitStatus
    ).toBe('deleted');

    const fork = await request('POST', 'createProj', {name: 'fork', template: 'main'});
    expect(fork.status).toBe(200);
    expect((await request('GET', 'gitInfo', {id: 'fork'}).then((response) => response.json())).branch).toBe('fork');
    expect(await readdir(join(root, 'proj/fork'))).toContain('empty');
    expect(await readFile(join(root, 'proj/fork/pending.txt'), 'utf8')).toBe('pending');
    expect(await request('GET', 'gitHistory', {id: 'fork'}).then((response) => response.json())).toHaveLength(1);
    expect(
      (await request('GET', 'list', {path: 'proj/fork'}).then((response) => response.json())).find(
        (entry: {name: string}) => entry.name === 'pending.txt'
      ).gitStatus
    ).toBe('added');
    expect(
      (await request('GET', 'list', {path: 'proj/fork'}).then((response) => response.json())).find(
        (entry: {name: string}) => entry.name === 'a.txt'
      ).gitStatus
    ).toBe('deleted');
  });

  it('commits an empty-directory operation recorded only in the log', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Initial'}));
    await request('POST', 'mkdir', {path: 'proj/main/empty'});
    const response = await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: ''}));
    expect(response.status).toBe(200);
    expect((await response.json()).message).toContain(',alice <alice@example.com>,mkdir,empty');
    expect(await request('GET', 'gitHistory', {id: 'main'}).then((result) => result.json())).toHaveLength(2);
  });

  it('omits generated email from CSV and migrates pending JSONL logs', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Initial'}));
    await writeFile(
      join(root, 'proj/main/.gitlog'),
      JSON.stringify({
        time: new Date().toISOString(),
        user: 'bob',
        name: 'bob',
        email: 'bob@ticlo.app',
        action: 'edit',
        path: 'a.txt',
      }) + '\n'
    );
    user = 'bob';
    await request('POST', 'upload', {path: 'proj/main/a.txt'}, 'changed');
    const log = await readFile(join(root, 'proj/main/.gitlog'), 'utf8');
    expect(log.trim().split('\n')).toHaveLength(1);
    expect(log).toContain(',bob,edit,a.txt');
    expect(log).not.toContain('@ticlo.app');
    const committed = await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Edited'}));
    expect(await committed.json()).toMatchObject({author: 'bob', email: 'bob@ticlo.app'});
  });

  it('keeps a user-only commit message without a log section', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    const response = await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'commit1'}));
    expect((await response.json()).message.trim()).toBe('commit1');
  });

  it('forks an initialized project before its first commit', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'mkdir', {path: 'proj/main/empty'});
    await request('POST', 'upload', {path: 'proj/main/new.txt'}, 'pending');
    expect((await request('POST', 'createProj', {name: 'fork', template: 'main'})).status).toBe(200);
    expect(await request('GET', 'gitHistory', {id: 'fork'}).then((response) => response.json())).toEqual([]);
    expect(await readdir(join(root, 'proj/fork/empty'))).toEqual([]);
    expect(await readFile(join(root, 'proj/fork/new.txt'), 'utf8')).toBe('pending');
  });
});
