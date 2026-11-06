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
});
