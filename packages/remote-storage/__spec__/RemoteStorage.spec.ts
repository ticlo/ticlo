import {describe, expect, it, vi} from 'vitest';
import {RemoteStorage} from '../RemoteStorage.ts';

describe('RemoteStorage request compatibility', () => {
  it('preserves custom fetch arguments, credentials, conditional headers and binary data', async () => {
    const bytes = new Uint8Array([0, 255, 13, 10]);
    const fetch = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(bytes, {headers: {'ETag': '"revision"', 'Content-Type': 'application/octet-stream'}})
    );
    const storage = new RemoteStorage({
      baseURL: 'https://example.com/file/',
      credentials: 'omit',
      headers: {'X-Storage': 'custom'},
      fetch: fetch as typeof globalThis.fetch,
    });
    const path = 'main/a ?#%.bin';
    expect(await storage.uploadFile(path, bytes, {revision: null, existsBehavior: 'fail'})).toEqual({
      revision: '"revision"',
    });
    const [url, init] = fetch.mock.calls[0];
    expect(new URL(url).searchParams.get('path')).toBe(`proj/${path}`);
    expect(new URL(url).searchParams.get('exists')).toBe('fail');
    expect(init).toMatchObject({method: 'POST', credentials: 'omit'});
    expect(new Headers(init.headers).get('X-Storage')).toBe('custom');
    expect(new Headers(init.headers).get('If-None-Match')).toBe('*');
    expect(new Uint8Array(init.body as ArrayBuffer)).toEqual(bytes);

    const read = await storage.getFile(path);
    expect(new Uint8Array(read.data)).toEqual(bytes);
    expect(read.contentType).toBe('application/octet-stream');
    expect(read.revision).toBe('"revision"');
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get('op')).toBe('get');
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get('path')).toBe(`proj/${path}`);
  });

  it('propagates native cancellation before calling a custom fetch', async () => {
    const fetch = vi.fn();
    const storage = new RemoteStorage({baseURL: 'https://example.com/file', fetch});
    const controller = new AbortController();
    controller.abort();
    await expect(storage.getFile('main/a.txt', {signal: controller.signal})).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('resolves file-path URLs and reads remote, external, and URL files uniformly', async () => {
    const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === 'https://cdn.example.com/a.txt') {
        return new Response('cdn-data', {headers: {'ETag': '"cdn-etag"', 'Content-Type': 'text/plain'}});
      }
      if (url === '//cdn.example.com/proto.txt') {
        return new Response('proto-data', {headers: {'Content-Type': 'text/plain'}});
      }
      if (url === '/assets/logo.txt') {
        return new Response('asset-data');
      }
      if (url.includes('op=get') && url.includes('path=proj%2Fmain%2Flocal.txt')) {
        return new Response('project-data', {headers: {'ETag': '"proj-etag"', 'Content-Type': 'text/plain'}});
      }
      return new Response('missing', {status: 404});
    });
    const storage = new RemoteStorage({
      baseURL: 'https://example.com/file/',
      headers: {'X-Auth': 'secret'},
      fetch: fetch as typeof globalThis.fetch,
    });

    // Case 1) URLs (including //) return as-is.
    expect(storage.resolveFilePath('https://cdn.example.com/a.txt', '+main')).toBe('https://cdn.example.com/a.txt');
    expect(storage.resolveFilePath('//cdn.example.com/proto.txt', '+main')).toBe('//cdn.example.com/proto.txt');
    // Case 2) external paths default to returning as-is.
    expect(storage.resolveFilePath('/assets/logo.txt', '+main')).toBe('/assets/logo.txt');
    expect(storage.resolveFilePath('./rel.txt', '+main')).toBe('./rel.txt');
    expect(storage.resolveFilePath('../rel.txt', '+main')).toBe('../rel.txt');
    // Case 3) & 4) build encoded project download URLs (including #root -> %23root).
    expect(storage.resolveFilePath('+proj1/a b.txt', '+main')).toBe('https://example.com/file/proj/proj1/a%20b.txt');
    expect(storage.resolveFilePath('local.txt', '+main')).toBe('https://example.com/file/proj/main/local.txt');
    expect(storage.resolveFilePath('root.txt', '+#root')).toBe('https://example.com/file/proj/%23root/root.txt');
    expect(storage.resolveFilePath('+main/../bad.txt')).toBeUndefined();

    const cdnRead = await storage.readFile('https://cdn.example.com/a.txt');
    expect(new TextDecoder().decode(cdnRead.data)).toBe('cdn-data');
    expect(cdnRead.revision).toBe('"cdn-etag"');
    expect(cdnRead.contentType).toBe('text/plain');
    // External URL reads must not leak file-server auth headers.
    expect(fetch.mock.calls[0][1]).not.toHaveProperty('headers');

    expect(new TextDecoder().decode((await storage.readFile('//cdn.example.com/proto.txt')).data)).toBe('proto-data');
    expect(new TextDecoder().decode((await storage.readFile('/assets/logo.txt')).data)).toBe('asset-data');
    expect(new TextDecoder().decode((await storage.readFile('local.txt', '+main')).data)).toBe('project-data');
  });
});
