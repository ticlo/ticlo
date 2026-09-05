import {describe, expect, it} from 'vitest';
import {getEditorUrl} from '../server.js';

describe('getEditorUrl', () => {
  it('keeps host and flow values isolated from editor query parameters', () => {
    const host = 'wss://example.test/ticlo?token=a&flow=host-value';
    const flow = 'folder.name&host=flow-value';
    const url = new URL(getEditorUrl(host, flow));

    expect(url.protocol).toBe('https:');
    expect(url.searchParams.get('host')).toBe(host);
    expect(url.searchParams.get('flow')).toBe(flow);
    expect([...url.searchParams.keys()]).toEqual(['host', 'flow']);
  });
});
