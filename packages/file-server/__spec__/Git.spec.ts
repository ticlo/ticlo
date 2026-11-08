import {mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import AdmZip from 'adm-zip';
import {Hono} from 'hono';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {routeRemoteStorage} from '@ticlo/file-server';

describe('project Git API', () => {
  const exec = promisify(execFile);
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

  it('uses main even when a project ID would not be a Git branch name', async () => {
    const created = await request('POST', 'createProj', {name: 'HEAD'});
    expect((await created.json()).id).toBe('HEAD');
    expect((await request('POST', 'gitInit', {id: 'HEAD'}).then((response) => response.json())).branch).toBe('main');
  });

  it('manages server projects and Git separately from browser projects', async () => {
    const scope = {scope: 'serv'};
    expect((await request('POST', 'createProj', {scope: '', name: 'bad'})).status).toBe(400);
    expect((await request('POST', 'createProj', {scope: 'usr', name: 'bad'})).status).toBe(400);
    const created = await request('POST', 'createProj', {...scope, name: 'main'});
    expect(created.status).toBe(200);
    expect(await readFile(join(root, 'serv/main/.proj'), 'utf8')).toContain('main');
    expect(await request('GET', 'listProj', scope).then((response) => response.json())).toContainEqual(
      expect.objectContaining({id: 'main'})
    );
    expect((await request('GET', 'readProj', {...scope, id: 'main'})).status).toBe(200);
    expect(
      (await request('POST', 'updateProj', {...scope, id: 'main'}, JSON.stringify({name: 'Server main'}))).status
    ).toBe(200);
    expect((await request('POST', 'gitInit', {...scope, id: 'main'}).then((response) => response.json())).branch).toBe(
      'main'
    );
    expect((await request('POST', 'upload', {path: 'serv/main/server.js'}, 'export const x = 1')).status).toBe(200);
    expect(
      (await request('GET', 'list', {path: 'serv/main'}).then((response) => response.json())).find(
        (entry: {name: string}) => entry.name === 'server.js'
      ).gitStatus
    ).toBe('added');
    expect((await request('POST', 'upload', {path: 'serv/main/.gitlog'}, 'bad')).status).toBe(403);
    const commit = await request('POST', 'gitCommit', {...scope, id: 'main'}, JSON.stringify({message: 'Server'}));
    expect(commit.status).toBe(200);
    const hash = (await commit.json()).hash;
    expect(
      (await request('GET', 'gitHistory', {...scope, id: 'main'}).then((response) => response.json()))[0].hash
    ).toBe(hash);
    expect((await request('GET', 'gitInfo', {id: 'main'}).then((response) => response.json())).initialized).toBe(false);
    await request('POST', 'upload', {path: 'serv/main/server.js'}, 'changed');
    expect((await request('POST', 'gitRestore', {path: 'serv/main/server.js'})).status).toBe(204);
    expect(await readFile(join(root, 'serv/main/server.js'), 'utf8')).toBe('export const x = 1');
    expect(
      (await request('POST', 'createProj', {...scope, name: 'snapshot', template: 'main', commit: hash})).status
    ).toBe(200);
    expect(await readFile(join(root, 'serv/snapshot/server.js'), 'utf8')).toBe('export const x = 1');
    expect(
      (await request('GET', 'gitInfo', {...scope, id: 'snapshot'}).then((response) => response.json())).initialized
    ).toBe(false);
    expect((await request('POST', 'deleteProj', {...scope, id: 'snapshot'})).status).toBe(204);
    expect((await request('GET', 'readProj', {...scope, id: 'snapshot'})).status).toBe(404);
  });

  it('serves JavaScript downloads with the JavaScript content type', async () => {
    await writeFile(join(root, 'proj/main/script.js'), 'export const value = 1;');
    const response = await app.request('/file/proj/main/script.js');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/javascript');
    expect(await response.text()).toBe('export const value = 1;');
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
      (await request('GET', 'gitInfo', {id: 'main'}).then((response) => response.json())).hasUncommittedChanges
    ).toBe(true);
    expect(await request('GET', 'gitBranches', {id: 'main'}).then((response) => response.json())).toEqual(['main']);
    expect(
      await request('GET', 'gitHistory', {id: 'main', branch: 'main'}).then((response) => response.json())
    ).toEqual([]);
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
    expect(
      (await request('GET', 'gitInfo', {id: 'main'}).then((response) => response.json())).hasUncommittedChanges
    ).toBe(false);
    expect((await request('POST', 'upload', {path: 'proj/main/a.txt'}, 'first edit')).status).toBe(200);
    expect((await request('POST', 'upload', {path: 'proj/main/a.txt'}, 'second edit')).status).toBe(200);
    expect((await request('POST', 'upload', {path: 'proj/main/name,"quoted".txt'}, 'quoted')).status).toBe(200);
    expect(
      (await request('POST', 'move', {path: 'proj/main/name,"quoted".txt', dest: 'proj/main/renamed.txt'})).status
    ).toBe(204);
    expect((await request('POST', 'updateProj', {id: 'main'}, JSON.stringify({name: 'Renamed'}))).status).toBe(200);
    const log = (await readFile(join(root, 'proj/main/.gitlog'), 'utf8')).trim().split('\n');
    expect(
      (await request('GET', 'gitInfo', {id: 'main'}).then((response) => response.json())).hasUncommittedChanges
    ).toBe(true);
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

  it('copies current files without Git, including pending changes and empty directories', async () => {
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
    expect(await request('GET', 'gitInfo', {id: 'fork'}).then((response) => response.json())).toEqual({
      initialized: false,
    });
    expect(await readdir(join(root, 'proj/fork'))).toContain('empty');
    expect(await readFile(join(root, 'proj/fork/pending.txt'), 'utf8')).toBe('pending');
    expect(await readdir(join(root, 'proj/fork'))).not.toEqual(
      expect.arrayContaining(['.git', '.gitignore', '.gitlog'])
    );
    expect((await request('POST', 'gitInit', {id: 'fork'}).then((response) => response.json())).branch).toBe('main');
  });

  it('creates an unversioned library from a chosen history commit', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Initial'}));
    const initial = (await request('GET', 'gitHistory', {id: 'main'}).then((response) => response.json()))[0].hash;
    await request('POST', 'upload', {path: 'proj/main/a.txt'}, 'later');
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Later'}));
    await request('POST', 'upload', {path: 'proj/main/pending.txt'}, 'pending');

    const created = await request('POST', 'createProj', {name: 'snapshot', template: 'main', commit: initial});
    expect(created.status).toBe(200);
    expect(await readFile(join(root, 'proj/snapshot/a.txt'), 'utf8')).toBe('initial');
    expect(await readdir(join(root, 'proj/snapshot'))).not.toEqual(
      expect.arrayContaining(['.git', '.gitignore', '.gitlog', 'pending.txt'])
    );
    expect((await request('GET', 'gitInfo', {id: 'snapshot'}).then((response) => response.json())).initialized).toBe(
      false
    );
    expect((await request('POST', 'createProj', {name: 'bad', template: 'main', commit: '0'.repeat(40)})).status).toBe(
      400
    );
    expect(await readdir(join(root, 'proj'))).not.toContain('bad');
  });

  it('backs up the current HEAD before resetting history and working files', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Initial'}));
    const initial = (await request('GET', 'gitHistory', {id: 'main'}).then((response) => response.json()))[0].hash;
    await request('POST', 'upload', {path: 'proj/main/a.txt'}, 'later');
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Later'}));
    const later = (await request('GET', 'gitHistory', {id: 'main'}).then((response) => response.json()))[0].hash;
    await request('POST', 'upload', {path: 'proj/main/pending.txt'}, 'pending');
    expect((await request('POST', 'gitReset', {id: 'main', commit: '0'.repeat(40)})).status).toBe(400);
    expect(await readFile(join(root, 'proj/main/pending.txt'), 'utf8')).toBe('pending');
    const response = await request('POST', 'gitReset', {id: 'main', commit: initial});
    expect(response.status).toBe(200);
    const {backupBranch} = await response.json();
    expect(backupBranch).toMatch(/^backup\/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/);
    expect((await exec('git', ['-C', join(root, 'proj/main'), 'rev-parse', backupBranch])).stdout.trim()).toBe(later);
    expect(await readFile(join(root, 'proj/main/a.txt'), 'utf8')).toBe('initial');
    expect(await readdir(join(root, 'proj/main'))).not.toContain('pending.txt');
    expect(await readFile(join(root, 'proj/main/.gitlog'), 'utf8')).toBe('');
    expect(await request('GET', 'gitHistory', {id: 'main'}).then((result) => result.json())).toHaveLength(1);
    expect(await request('GET', 'gitBranches', {id: 'main'}).then((result) => result.json())).toEqual([
      backupBranch,
      'main',
    ]);
    const backupHistory = await request('GET', 'gitHistory', {id: 'main', branch: backupBranch}).then((result) =>
      result.json()
    );
    expect(backupHistory.map((commit: {hash: string}) => commit.hash)).toEqual([later, initial]);
    expect((await request('GET', 'gitHistory', {id: 'main', branch: 'missing'})).status).toBe(404);
    expect((await request('GET', 'gitHistory', {id: 'main', branch: '--all'})).status).toBe(404);
    expect((await request('POST', 'createProj', {name: 'from-backup', template: 'main', commit: later})).status).toBe(
      200
    );
    expect(await readFile(join(root, 'proj/from-backup/a.txt'), 'utf8')).toBe('later');
    expect((await request('POST', 'gitReset', {id: 'main', commit: later})).status).toBe(200);
    expect(await readFile(join(root, 'proj/main/a.txt'), 'utf8')).toBe('later');
    expect((await request('GET', 'gitInfo', {id: 'main'}).then((result) => result.json())).branch).toBe('main');
    expect((await exec('git', ['-C', join(root, 'proj/main'), 'status', '--porcelain'])).stdout).toBe('');
  });

  it('numbers backup branches from -2 when resetting repeatedly in the same minute', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Initial'}));
    const commit = (await request('GET', 'gitHistory', {id: 'main'}).then((response) => response.json()))[0].hash;
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date('2026-11-07T12:34:00Z'));
    try {
      const branches: string[] = [];
      for (let index = 0; index < 3; index++) {
        const response = await request('POST', 'gitReset', {id: 'main', commit});
        expect(response.status).toBe(200);
        branches.push((await response.json()).backupBranch);
      }
      expect(branches).toEqual([branches[0], `${branches[0]}-2`, `${branches[0]}-3`]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('deletes a backup branch only with write access and keeps main', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Initial'}));
    const initial = (await request('GET', 'gitHistory', {id: 'main'}).then((response) => response.json()))[0].hash;
    await request('POST', 'upload', {path: 'proj/main/a.txt'}, 'later');
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Later'}));
    const {backupBranch} = await request('POST', 'gitReset', {id: 'main', commit: initial}).then((response) =>
      response.json()
    );
    expect((await request('POST', 'gitDeleteBranch', {id: 'main'})).status).toBe(400);
    expect((await request('POST', 'gitDeleteBranch', {id: 'main', branch: 'main'})).status).toBe(403);
    expect((await request('POST', 'gitDeleteBranch', {id: 'main', branch: 'missing'})).status).toBe(404);

    const readonly = new Hono();
    routeRemoteStorage(readonly, {
      rootDir: root,
      authProvider: () => ({getUserId: () => 'reader', canRead: () => true, canWrite: () => false}),
    });
    expect(
      (
        await readonly.request(
          `/file?${new URLSearchParams({op: 'gitDeleteBranch', id: 'main', branch: backupBranch})}`,
          {
            method: 'POST',
          }
        )
      ).status
    ).toBe(403);

    await exec('git', ['-C', join(root, 'proj/main'), 'checkout', backupBranch]);
    expect((await request('POST', 'gitDeleteBranch', {id: 'main', branch: backupBranch})).status).toBe(409);
    await exec('git', ['-C', join(root, 'proj/main'), 'checkout', 'main']);
    expect((await request('POST', 'gitDeleteBranch', {id: 'main', branch: backupBranch})).status).toBe(204);
    expect(await request('GET', 'gitBranches', {id: 'main'}).then((response) => response.json())).toEqual(['main']);
    expect((await request('GET', 'gitHistory', {id: 'main', branch: backupBranch})).status).toBe(404);
  });

  it('restores modified and deleted tracked files and records the restore', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Initial'}));
    await request('POST', 'upload', {path: 'proj/main/a.txt'}, 'changed');
    const readonly = new Hono();
    routeRemoteStorage(readonly, {
      rootDir: root,
      authProvider: () => ({getUserId: () => 'reader', canRead: () => true, canWrite: () => false}),
    });
    expect((await readonly.request('/file?op=gitRestore&path=proj/main/a.txt', {method: 'POST'})).status).toBe(403);
    expect((await request('POST', 'gitRestore', {path: 'proj/main/a.txt'})).status).toBe(204);
    expect(await readFile(join(root, 'proj/main/a.txt'), 'utf8')).toBe('initial');
    expect(await readFile(join(root, 'proj/main/.gitlog'), 'utf8')).toMatch(/,restore,a\.txt\n$/);
    expect(await readFile(join(root, 'proj/main/.gitlog'), 'utf8')).not.toContain(',edit,a.txt');

    const restoredCommit = await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Restore'}));
    expect((await restoredCommit.json()).message).toContain(',restore,a.txt');
    await request('POST', 'delete', {path: 'proj/main/a.txt'});
    expect((await request('POST', 'gitRestore', {path: 'proj/main/a.txt'})).status).toBe(204);
    expect(await readFile(join(root, 'proj/main/a.txt'), 'utf8')).toBe('initial');
    expect(await readFile(join(root, 'proj/main/.gitlog'), 'utf8')).toMatch(/,restore,a\.txt\n$/);
    expect(await readFile(join(root, 'proj/main/.gitlog'), 'utf8')).not.toContain(',delete,a.txt');
    expect(
      (await request('GET', 'info', {path: 'proj/main/a.txt'}).then((response) => response.json())).gitStatus
    ).toBeUndefined();
    expect((await request('POST', 'gitRestore', {path: 'proj/main/a.txt'})).status).toBe(409);
    expect((await request('POST', 'gitRestore', {path: 'proj/main/.proj'})).status).toBe(403);
  });

  it('coalesces a new file deleted within an hour only when every edit belongs to the same user', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Initial'}));
    await request('POST', 'upload', {path: 'proj/main/new.txt'}, 'new');
    await request('POST', 'upload', {path: 'proj/main/new.txt'}, 'edited');
    await request('POST', 'delete', {path: 'proj/main/new.txt'});
    expect(await readFile(join(root, 'proj/main/.gitlog'), 'utf8')).toBe('');

    await request('POST', 'upload', {path: 'proj/main/new.txt'}, 'new');
    user = 'bob';
    await request('POST', 'delete', {path: 'proj/main/new.txt'});
    const differentUsers = await readFile(join(root, 'proj/main/.gitlog'), 'utf8');
    expect(differentUsers).toContain(',alice <alice@example.com>,create,new.txt');
    expect(differentUsers).toContain(',bob,delete,new.txt');

    user = 'alice';
    await request('POST', 'upload', {path: 'proj/main/old.txt'}, 'new');
    const logPath = join(root, 'proj/main/.gitlog');
    await writeFile(
      logPath,
      (await readFile(logPath, 'utf8')).replace(
        /^[^,]+(?=,alice <alice@example.com>,create,old\.txt$)/m,
        '2000-01-01T00:00:00.000Z'
      )
    );
    await request('POST', 'delete', {path: 'proj/main/old.txt'});
    expect(await readFile(logPath, 'utf8')).toContain(',delete,old.txt');
  });

  it('does not merge edits or restores across users', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Initial'}));
    await request('POST', 'upload', {path: 'proj/main/a.txt'}, 'alice edit');
    user = 'bob';
    await request('POST', 'upload', {path: 'proj/main/a.txt'}, 'bob edit');
    user = 'alice';
    await request('POST', 'gitRestore', {path: 'proj/main/a.txt'});
    const log = await readFile(join(root, 'proj/main/.gitlog'), 'utf8');
    expect(log.match(/,edit,a\.txt/g)).toHaveLength(2);
    expect(log).toContain(',alice <alice@example.com>,restore,a.txt');
  });

  it('commits an empty-directory operation recorded only in the log', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'gitCommit', {id: 'main'}, JSON.stringify({message: 'Initial'}));
    await request('POST', 'mkdir', {path: 'proj/main/empty'});
    expect(
      (await request('GET', 'gitInfo', {id: 'main'}).then((response) => response.json())).hasUncommittedChanges
    ).toBe(true);
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

  it('copies an initialized project before its first commit without initializing Git', async () => {
    await request('POST', 'gitInit', {id: 'main'});
    await request('POST', 'mkdir', {path: 'proj/main/empty'});
    await request('POST', 'upload', {path: 'proj/main/new.txt'}, 'pending');
    expect((await request('POST', 'createProj', {name: 'fork', template: 'main'})).status).toBe(200);
    expect((await request('GET', 'gitInfo', {id: 'fork'}).then((response) => response.json())).initialized).toBe(false);
    expect(await readdir(join(root, 'proj/fork/empty'))).toEqual([]);
    expect(await readFile(join(root, 'proj/fork/new.txt'), 'utf8')).toBe('pending');
  });
});
