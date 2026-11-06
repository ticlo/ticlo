import {describe, expect, it, vi} from 'vitest';
import {RemoteStorage} from '../RemoteStorage.ts';

describe('RemoteStorage Git operations', () => {
  it('uses the project Git endpoints and leaves local without Git support', async () => {
    const fetch = vi.fn(async (request: Request) =>
      Response.json(
        request.url.includes('gitCommit')
          ? {hash: 'abc', author: 'alice', email: 'alice@ticlo.app', date: '', message: ''}
          : request.method === 'GET'
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
    expect(fetch.mock.calls[0][0].url).toContain('op=gitInfo&id=main');
    expect(fetch.mock.calls[0][0].method).toBe('GET');
    expect(fetch.mock.calls[1][0].url).toContain('op=gitInit&id=main');
    expect(fetch.mock.calls[1][0].method).toBe('POST');
    expect(await fetch.mock.calls[2][0].text()).toBe('{"message":""}');
    expect(fetch.mock.calls[2][0].headers.get('Content-Type')).toBe('application/json');
  });

  it('reports an old file server clearly', async () => {
    const storage = new RemoteStorage({
      baseURL: 'https://example.com/file',
      fetch: async () => new Response('{"message":"Operation requires POST"}', {status: 405}),
    });
    await expect(storage.getGitInfo('main')).rejects.toThrow('This file server does not support Git');
  });
});
