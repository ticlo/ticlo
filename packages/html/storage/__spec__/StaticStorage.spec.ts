import {afterEach, describe, expect, it, vi} from 'vitest';
import {Flow, FlowFolder, Root, encodeSorted} from '@ticlo/core';
import {StaticFlowStorage, StaticStorage} from '../StaticStorage.ts';

const baseUrl = 'http://static.test';
const rootUrl = `${baseUrl}/proj/_root`;

function mockFiles(files: Record<string, string>) {
  const fetchMock = vi.fn(async (url: string) => {
    return new Response(files[url] ?? '', {status: url in files ? 200 : 404});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('StaticStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses file-server filenames with URL escaping and separate library folders', async () => {
    const fetchMock = mockFiles({
      [`${rootUrl}/storage/a%252fb%253fc%23%25%20d.str`]: 'value',
      [`${rootUrl}/storage/%2BtestNs.key.str`]: 'literal key',
      [`${baseUrl}/proj/testNs/libs/lib.%23.worker.ticlo`]: '{"worker":"test"}',
      [`${baseUrl}/proj/testNs/main.%23.worker.ticlo`]: '{"value":"subflow"}',
      [`${rootUrl}/libs/lib.ticlo`]: '{"worker":"root"}',
    });
    const storage = new StaticStorage(`${rootUrl}/storage/`, '.str');
    expect(await storage.load('a/b?c#% d')).toBe('value');
    expect(await storage.load('+testNs.key')).toBe('literal key');
    const flows = new StaticFlowStorage(baseUrl);
    expect(await flows.loadLib('+testNs', 'lib.#.worker')).toEqual({worker: 'test'});
    expect(await flows.loadFlow('+testNs.main.#.worker')).toEqual({value: 'subflow'});
    expect(await flows.loadLib('', 'lib')).toEqual({worker: 'root'});
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('keeps saves and deletions in memory and notifies listeners', async () => {
    const fetchMock = mockFiles({[`${baseUrl}/key`]: 'remote'});
    const storage = new StaticStorage(baseUrl);
    const listener = vi.fn();
    expect(await storage.load('key')).toBe('remote');
    storage.listen('key', listener);
    storage.save('key', 'local');
    expect(await storage.load('key')).toBe('local');
    expect(listener).toHaveBeenLastCalledWith('local');

    storage.delete('key');
    expect(await storage.load('key')).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    storage.unlisten('key', listener);
    storage.save('key', '');
    expect(await storage.load('key')).toBe('');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(storage.streams.size).toBe(0);
    // Reloading the page creates a new instance and reads the original file.
    expect(await new StaticStorage(baseUrl).load('key')).toBe('remote');
  });

  it.each(['save', 'delete'] as const)('preserves a %s during a pending HTTP read', async (operation) => {
    let finish: (response: Response) => void;
    vi.stubGlobal('fetch', () => new Promise<Response>((resolve) => (finish = resolve)));
    const storage = new StaticStorage(baseUrl);
    const reading = storage.load('key');
    if (operation === 'save') {
      storage.save('key', 'local');
    } else {
      storage.delete('key');
    }
    finish(new Response('remote'));
    expect(await reading).toBe(operation === 'save' ? 'local' : null);
    expect(await storage.load('key')).toBe(operation === 'save' ? 'local' : null);
  });

  it('returns null for missing files, HTTP errors, network errors and invalid flows', async () => {
    const fetchMock = mockFiles({[`${rootUrl}/broken.ticlo`]: '{invalid'});
    const storage = new StaticFlowStorage(baseUrl);
    expect(await storage.loadFlow('missing')).toBeNull();
    expect(await storage.loadFlow('broken')).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response('error', {status: 500}));
    expect(await storage.load('error')).toBeNull();
    fetchMock.mockRejectedValueOnce(new TypeError('network error'));
    expect(await storage.load('offline')).toBeNull();
  });
});

describe('StaticFlowStorage', () => {
  let root: Root;

  afterEach(() => {
    root?.destroy();
    vi.unstubAllGlobals();
  });

  it('loads globals first and folder flows in name order, skipping subflows', async () => {
    const fetchMock = mockFiles({
      [`${rootUrl}/.list.json`]: JSON.stringify([
        'folder.child.ticlo',
        'first.ticlo',
        'folder.flow.ticlo',
        '#global.ticlo',
        'first.#.worker.ticlo',
        'libs/',
        'broken.ticlo',
        'notes.txt',
      ]),
      [`${rootUrl}/%23global.ticlo`]: encodeSorted({'#is': '', '^value': 42}),
      [`${rootUrl}/first.ticlo`]: encodeSorted({'#is': '', 'value': 1}),
      [`${rootUrl}/folder.child.ticlo`]: encodeSorted({'#is': '', 'value': 2}),
      [`${rootUrl}/folder.flow.ticlo`]: encodeSorted({'#is': '', 'value': 3}),
      [`${rootUrl}/broken.ticlo`]: '{invalid',
    });
    root = new Root();
    const storage = new StaticFlowStorage(baseUrl);
    await root.setStorage(storage);

    expect(storage.inited).toBe(true);
    expect(root._globalRoot.getValue('^value')).toBe(42);
    expect(root.queryValue('first.value')).toBe(1);
    expect(root.queryValue('folder.child.value')).toBe(2);
    expect(root.queryValue('folder')).toBeInstanceOf(FlowFolder);
    expect(root.queryValue('folder.flow.value')).toBe(3);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${rootUrl}/.list.json`,
      `${rootUrl}/%23global.ticlo`,
      `${rootUrl}/broken.ticlo`,
      `${rootUrl}/first.ticlo`,
      `${rootUrl}/folder.child.ticlo`,
      `${rootUrl}/folder.flow.ticlo`,
    ]);

    const flow = root.queryValue('first') as Flow;
    flow.setValue('value', 4);
    flow.applyChange();
    expect((await storage.loadFlow('first')).value).toBe(4);
    root._globalRoot.setValue('^value', 43);
    root._globalRoot.applyChange();
    expect((await storage.loadFlow('#global'))['^value']).toBe(43);
    root.deleteFlow('folder.child');
    expect(await storage.loadFlow('folder.child')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('supports new flows and library saves without HTTP writes', async () => {
    const fetchMock = mockFiles({[`${rootUrl}/.list.json`]: '[]'});
    root = new Root();
    const storage = new StaticFlowStorage(baseUrl);
    await root.setStorage(storage);
    expect(root._globalRoot.save()).toEqual({'#is': ''});

    const flow = root.addFlow('newFlow', {'#is': '', 'value': 123});
    flow.applyChange();
    expect(await storage.loadFlow('newFlow')).toEqual({'#is': '', 'value': 123});
    root.deleteFlow('newFlow');
    expect(await storage.loadFlow('newFlow')).toBeNull();
    storage.saveLib('+testNs', 'testLib', {worker: 'test'});
    expect(await storage.loadLib('+testNs', 'testLib')).toEqual({worker: 'test'});
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`${rootUrl}/.list.json`, `${rootUrl}/%23global.ticlo`]);
  });

  it('loads only the selected project and recursive deps, with globals always from _root', async () => {
    const fetchMock = mockFiles({
      [`${rootUrl}/.list.json`]: '["#global.ticlo","unused.ticlo"]',
      [`${rootUrl}/%23global.ticlo`]: encodeSorted({'#is': '', '^value': 42}),
      [`${baseUrl}/proj/main/.list.json`]: JSON.stringify([
        'run.ticlo',
        'deps/',
        'libs/',
        '#global.ticlo',
        'bad:name.ticlo',
        'bad..name.ticlo',
        'bad/path.ticlo',
        '+other.ticlo',
        'run.#.worker.ticlo',
      ]),
      [`${baseUrl}/proj/main/deps/.list.json`]: '["shared/","common/","bad.name/","bad/path/","not-a-folder"]',
      [`${baseUrl}/proj/main/run.ticlo`]: encodeSorted({value: 1}),
      [`${baseUrl}/proj/main/%23global.ticlo`]: encodeSorted({'^value': 99}),
      [`${baseUrl}/proj/shared/.list.json`]: '["folder.child.ticlo","deps/"]',
      [`${baseUrl}/proj/shared/deps/.list.json`]: '["common/"]',
      [`${baseUrl}/proj/shared/folder.child.ticlo`]: encodeSorted({value: 2}),
      [`${baseUrl}/proj/common/.list.json`]: '["run.ticlo","deps/"]',
      [`${baseUrl}/proj/common/deps/.list.json`]: '["main/"]',
      [`${baseUrl}/proj/common/run.ticlo`]: encodeSorted({value: 3}),
      [`${baseUrl}/proj/unrelated/.list.json`]: '["run.ticlo"]',
    });
    root = new Root();
    const storage = new StaticFlowStorage(baseUrl, 'main');
    await root.setStorage(storage);
    expect([...storage.projects].sort()).toEqual(['common', 'main', 'shared']);
    expect(root._globalRoot.getValue('^value')).toBe(42);
    expect(root.queryValue('+main.run.value')).toBe(1);
    expect(root.queryValue('+shared.folder.child.value')).toBe(2);
    expect(root.queryValue('+common.run.value')).toBe(3);
    expect(root.queryValue('unused')).toBeUndefined();
    expect(root.queryValue('+unrelated')).toBeUndefined();
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls.filter((url) => url.endsWith('.ticlo'))).toEqual([
      `${rootUrl}/%23global.ticlo`,
      `${baseUrl}/proj/common/run.ticlo`,
      `${baseUrl}/proj/shared/folder.child.ticlo`,
      `${baseUrl}/proj/main/run.ticlo`,
    ]);
    expect(urls.filter((url) => url === `${baseUrl}/proj/common/.list.json`)).toHaveLength(1);
  });

  it('keeps libraries separate from flows and retains temporary saves when a root shuts down', async () => {
    mockFiles({
      [`${rootUrl}/.list.json`]: '[]',
      [`${baseUrl}/proj/main/.list.json`]: '["same.ticlo","libs/"]',
      [`${baseUrl}/proj/main/same.ticlo`]: encodeSorted({value: 'flow'}),
      [`${baseUrl}/proj/main/libs/same.ticlo`]: encodeSorted({value: 'library'}),
    });
    root = new Root();
    const storage = new StaticFlowStorage(baseUrl, 'main');
    await root.setStorage(storage);
    expect(await storage.loadLib('+main', 'same')).toEqual({value: 'library'});
    storage.saveLib('+main', 'same', {value: 'temporary library'});
    const flow = root.queryValue('+main.same') as Flow;
    flow.setValue('value', 'temporary flow');
    flow.applyChange();
    root.destroy();
    expect((await storage.loadFlow('+main.same')).value).toBe('temporary flow');
    expect(await storage.loadFlow('+main.:same')).toEqual({value: 'temporary library'});
    const reloaded = new StaticFlowStorage(baseUrl, 'main');
    expect(await reloaded.loadFlow('+main.same')).toEqual({value: 'flow'});
    expect(await reloaded.loadLib('+main', 'same')).toEqual({value: 'library'});
  });

  it('loads ordinary _root flows when _root is a dependency', async () => {
    mockFiles({
      [`${rootUrl}/.list.json`]: '["plain.ticlo"]',
      [`${rootUrl}/plain.ticlo`]: encodeSorted({value: 7}),
      [`${baseUrl}/proj/main/.list.json`]: '["deps/"]',
      [`${baseUrl}/proj/main/deps/.list.json`]: '["_root/"]',
    });
    root = new Root();
    await root.setStorage(new StaticFlowStorage(baseUrl, 'main'));
    expect(root.queryValue('plain.value')).toBe(7);
    expect(root.queryValue('+_root')).toBeUndefined();
  });

  it.each([false, true])('rejects a missing dependency index or project (has deps index: %s)', async (hasIndex) => {
    mockFiles({
      [`${rootUrl}/.list.json`]: '["deps/"]',
      ...(hasIndex ? {[`${rootUrl}/deps/.list.json`]: '["missing/"]'} : {}),
    });
    root = new Root();
    const storage = new StaticFlowStorage(baseUrl);
    await expect(root.setStorage(storage)).rejects.toThrow('HTTP 404');
    expect(storage.inited).toBe(false);
  });

  it.each(['bad.name', 'bad/name', ''])('rejects an invalid initial project: %s', (project) => {
    expect(() => new StaticFlowStorage(baseUrl, project)).toThrow('Invalid project id');
  });

  it.each([null, '{invalid', '{}', '[123]'])('rejects a missing or invalid index: %s', async (index) => {
    mockFiles(index === null ? {} : {[`${rootUrl}/.list.json`]: index});
    root = new Root();
    const storage = new StaticFlowStorage(baseUrl);
    await expect(root.setStorage(storage)).rejects.toThrow();
    expect(storage.inited).toBe(false);
  });
});
