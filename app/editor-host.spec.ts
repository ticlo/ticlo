import {describe, expect, it} from 'vitest';
import {editorHostUrls} from './editor-host.ts';

describe('editor host URLs', () => {
  it('derives runtime and file endpoints from a server root', () => {
    expect(editorHostUrls('https://example.com/')).toEqual({
      runtimeUrl: 'https://example.com/ticlo',
      fileUrl: 'https://example.com/file',
    });
    expect(editorHostUrls('http://127.0.0.1:8010/')).toEqual({
      runtimeUrl: 'http://127.0.0.1:8010/ticlo',
      fileUrl: 'http://127.0.0.1:8010/file',
    });
  });

  it('keeps an explicit runtime endpoint and derives its sibling file endpoint', () => {
    expect(editorHostUrls('ws://127.0.0.1:8010/ticlo')).toEqual({
      runtimeUrl: 'http://127.0.0.1:8010/ticlo',
      fileUrl: 'http://127.0.0.1:8010/file',
    });
    expect(editorHostUrls('https://example.com/api/ticlo')).toEqual({
      runtimeUrl: 'https://example.com/api/ticlo',
      fileUrl: 'https://example.com/api/file',
    });
  });
});
