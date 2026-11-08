import {describe, expect, it, vi} from 'vitest';
import {RemoteStorage} from '../RemoteStorage.ts';

describe('RemoteStorage Git operations', () => {
  it('reads the branch list and history for a selected branch', async () => {
    const fetch = vi.fn(async (_url: string, _options: RequestInit) => Response.json([]));
    const storage = new RemoteStorage({baseURL: 'https://example.com/file', fetch: fetch as typeof globalThis.fetch});
    expect(await storage.getGitBranches('main')).toEqual([]);
    expect(await storage.getGitHistory('main', {branch: 'backup/old'})).toEqual([]);
    await storage.deleteGitBranch('main', 'backup/old');
    expect(fetch.mock.calls[0][0]).toContain('op=gitBranches&id=main');
    expect(fetch.mock.calls[1][0]).toContain('op=gitHistory&id=main&branch=backup%2Fold');
    expect(fetch.mock.calls[2][0]).toContain('op=gitDeleteBranch&id=main&branch=backup%2Fold');
    expect(fetch.mock.calls[2][1].method).toBe('POST');
  });

  it('uses the project Git endpoints and leaves local without Git support', async () => {
    const fetch = vi.fn(async (url: string, options: RequestInit) =>
      Response.json(
        url.includes('gitCommit')
          ? {hash: 'abc', author: 'alice', email: 'alice@ticlo.app', date: '', message: ''}
          : url.includes('gitReset')
            ? {backupBranch: 'backup/2026-11-07-01-00'}
            : url.includes('createProj')
              ? {id: 'snapshot'}
              : options.method === 'GET'
                ? {initialized: false}
                : {initialized: true, branch: 'main'}
      )
    );
    const storage = new RemoteStorage({baseURL: 'https://example.com/file', fetch: fetch as typeof globalThis.fetch});
    expect(storage.supportsGit('main')).toBe(true);
    expect(storage.supportsGit('local')).toBe(false);
    expect(await storage.getGitInfo('main')).toEqual({initialized: false});
    expect(await storage.initGit('main')).toEqual({initialized: true, branch: 'main'});
    expect((await storage.commitGit('main', '')).hash).toBe('abc');
    const changed = vi.fn();
    storage.subscribeFileChanges(changed);
    await storage.restoreGitFile('main/a.txt');
    expect(await storage.resetGitToCommit('main', 'abc')).toEqual({backupBranch: 'backup/2026-11-07-01-00'});
    expect(await storage.createProjectFromCommit('main', 'snapshot', 'abc')).toEqual({id: 'snapshot'});
    expect(fetch.mock.calls[0][0]).toContain('op=gitInfo&id=main');
    expect(fetch.mock.calls[0][1].method).toBe('GET');
    expect(fetch.mock.calls[1][0]).toContain('op=gitInit&id=main');
    expect(fetch.mock.calls[1][1].method).toBe('POST');
    expect(fetch.mock.calls[2][1].body).toBe('{"message":""}');
    expect(new Headers(fetch.mock.calls[2][1].headers).get('Content-Type')).toBe('application/json');
    expect(fetch.mock.calls[3][0]).toContain('op=gitRestore&path=proj%2Fmain%2Fa.txt');
    expect(fetch.mock.calls[3][1].method).toBe('POST');
    expect(changed).toHaveBeenCalledWith('main/a.txt');
    expect(changed).toHaveBeenCalledWith('main');
    expect(changed).toHaveBeenCalledWith('snapshot');
    expect(fetch.mock.calls[4][0]).toContain('op=gitReset&id=main&commit=abc');
    expect(fetch.mock.calls[5][0]).toContain('op=createProj&name=snapshot&template=main&commit=abc');
    await expect(storage.restoreGitFile('local/a.txt')).rejects.toMatchObject({code: 'readonly'});
    await expect(storage.resetGitToCommit('local', 'abc')).rejects.toMatchObject({code: 'readonly'});
    await expect(storage.createProjectFromCommit('local', 'snapshot', 'abc')).rejects.toMatchObject({code: 'readonly'});
  });

  it('reports an old file server clearly', async () => {
    const storage = new RemoteStorage({
      baseURL: 'https://example.com/file',
      fetch: async () => new Response('{"message":"Operation requires POST"}', {status: 405}),
    });
    await expect(storage.getGitInfo('main')).rejects.toThrow('This file server does not support Git');
  });
});
