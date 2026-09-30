import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Root} from '../../block/Flow.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import {decode, encode} from '../../util/Serialize.ts';
import type {DataMap} from '../../util/DataTypes.ts';
import {FlowEditor} from '../../worker/FlowEditor.ts';

function createRoot() {
  const root = new Root();
  root.addFlow('Main', {
    value: 10,
    source: {'#is': '', 'a': {'#is': '', '~input': '##.##.value'}},
    target: {'#is': '', 'inner': {'#is': ''}},
  });
  root.addFlow('Other', {value: 20, target: {'#is': '', 'inner': {'#is': ''}}});
  return root;
}

describe('Copy source validation', () => {
  let root: Root;
  let client: ReturnType<typeof makeLocalConnection>[1];
  let server: ReturnType<typeof makeLocalConnection>[0];

  beforeEach(() => {
    root = createRoot();
    [server, client] = makeLocalConnection(root, false);
  });

  afterEach(() => {
    client.destroy();
    root.destroy();
  });

  it('accepts clipboard roundtrips and reordered keys for repeated pastes', async () => {
    const copied = (await client.copy('Main.source', ['a'])).value;
    expect(copied['#_copy_from']).toBe('Main.source');
    const clipboard = encode(copied);
    const decoded = decode(clipboard);
    const reordered = {'#_copy_from': decoded['#_copy_from'], 'a': {'~input': decoded.a['~input'], '#is': ''}};
    const received = vi.spyOn(server, 'onData');
    for (const data of [reordered, decoded]) {
      const result = await client.paste('Main.target.inner', data, 'rename');
      expect(root.queryProperty(`Main.target.inner.${result.pasted[0]}.input`)._bindingPath).toBe('##.##.##.value');
    }
    expect(received.mock.calls.filter(([request]) => request.cmd === 'paste')).toHaveLength(2);
    for (const [request] of received.mock.calls) {
      if (request.cmd === 'paste') expect((request.data as DataMap)['#_copy_from']).toBe('Main.source');
    }
    expect(encode(copied)).toBe(clipboard);
  });

  it('removes source metadata before sending to a different server with identical paths', async () => {
    const copied = (await client.copy('Main.source', ['a'])).value;
    const clipboard = encode(copied);
    const otherRoot = createRoot();
    const [otherServer, otherClient] = makeLocalConnection(otherRoot, false);
    try {
      const received = vi.spyOn(otherServer, 'onData');
      await otherClient.paste('Main.target.inner', copied);
      const request = received.mock.calls.find(([data]) => data.cmd === 'paste')[0];
      expect(request.data).not.toHaveProperty('#_copy_from');
      expect(otherRoot.queryProperty('Main.target.inner.a.input')._bindingPath).toBe('##.##.value');
      expect(encode(copied)).toBe(clipboard);
    } finally {
      otherClient.destroy();
      otherRoot.destroy();
    }
  });

  it('replaces the hash on successful copies and retains it on failed copies', async () => {
    const copied = (await client.copy('Main.source', ['a'])).value;
    await expect(client.copy('Main.source', ['missing'])).rejects.toBe('nothing to copy');
    await client.paste('Main.target.inner', copied);
    expect(root.queryProperty('Main.target.inner.a.input')._bindingPath).toBe('##.##.##.value');
    await client.copy('Main', ['value']);
    const received = vi.spyOn(server, 'onData');
    await client.paste('Main.target.inner', copied, 'rename');
    expect(received.mock.calls.find(([data]) => data.cmd === 'paste')[0].data).not.toHaveProperty('#_copy_from');
    expect(root.queryProperty('Main.target.inner.a1.input')._bindingPath).toBe('##.##.value');
  });

  it.each(['contents', 'source path'])('ignores copy source after changing %s', async (change) => {
    const copied = (await client.copy('Main.source', ['a'])).value;
    const modified = change === 'contents' ? {...copied, extra: 1} : {...copied, '#_copy_from': 'Main'};
    const received = vi.spyOn(server, 'onData');
    await client.paste('Main.target.inner', modified);
    expect(received.mock.calls.find(([data]) => data.cmd === 'paste')[0].data).not.toHaveProperty('#_copy_from');
    expect(root.queryProperty('Main.target.inner.a.input')._bindingPath).toBe('##.##.value');
    expect(modified).toHaveProperty('#_copy_from');
  });

  it('shares callback copy results between policy views of the base connection', async () => {
    const copyView = client.withPolicy({allowPaths: ['Main.source', 'Main.source.**']});
    const pasteView = client.withPolicy({
      allowPaths: ['Main.target', 'Main.target.**'],
      denyProps: ['#_copy_from'],
    });
    const copied = await new Promise<DataMap>((resolve, reject) => {
      const id = copyView.copy('Main.source', ['a'], false, {
        onUpdate: (response) => resolve(response.value as DataMap),
        onError: reject,
      });
      expect(typeof id).toBe('string');
    });
    expect(client.copiedData).toBeTypeOf('number');
    await new Promise<void>((resolve, reject) => {
      pasteView.paste('Main.target.inner', copied, undefined, {onDone: resolve, onError: reject});
    });
    expect(root.queryProperty('Main.target.inner.a.input')._bindingPath).toBe('##.##.##.value');
  });

  it('ignores cached copy source after reconnecting', async () => {
    const copied = (await client.copy('Main.source', ['a'])).value;
    client.onDisconnect();
    expect(client.copiedData).toBeUndefined();
    client.reconnect();
    await client.paste('Main.target.inner', copied);
    expect(root.queryProperty('Main.target.inner.a.input')._bindingPath).toBe('##.##.value');
  });

  it('keeps cross-flow bindings and ordinary paste bindings unchanged', async () => {
    const copied = (await client.copy('Main.source', ['a'])).value;
    await client.paste('Other.target.inner', copied);
    expect(root.queryProperty('Other.target.inner.a.input')._bindingPath).toBe('##.##.value');
    await client.paste('Main.target.inner', {a: copied.a});
    expect(root.queryProperty('Main.target.inner.a.input')._bindingPath).toBe('##.##.value');
  });

  it('validates static copy metadata together with the complete clipboard payload', async () => {
    const library = root.addFlow('Workers', {
      '#functions': {
        ':clipboard-worker': {
          type: 'worker',
          worker: {'#is': '', 'a': {'#is': ''}, '#static': {'#is': '', 'b': {'#is': ''}}},
        },
      },
    });
    const editor = FlowEditor.createFromFunction(library, '#edit-clipboard-worker', ':clipboard-worker', null);
    const path = editor.getFullPath();
    const copied = (await client.copy(path, ['a', '#static.b'])).value;
    expect(copied['#_copy_from']).toBe(path);
    expect(copied['#static']['#_copy_from']).toBeTypeOf('string');
    const clipboard = encode(copied);
    expect((await client.paste(path, copied, 'rename')).pasted).toEqual(['a1', '#static.b1']);
    const [otherServer, otherClient] = makeLocalConnection(root, false);
    try {
      const received = vi.spyOn(otherServer, 'onData');
      expect((await otherClient.paste(path, copied, 'rename')).pasted).toEqual(['a2', '#static.b2']);
      const data = received.mock.calls.find(([request]) => request.cmd === 'paste')[0].data as DataMap;
      expect(data).not.toHaveProperty('#_copy_from');
      expect(data['#static']).not.toHaveProperty('#_copy_from');
      expect(encode(copied)).toBe(clipboard);
    } finally {
      otherClient.destroy();
    }
  });
});
