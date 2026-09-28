import {afterEach, describe, expect, it, vi} from 'vitest';
import {Flow, FlowFolder, Root, encodeSorted} from '@ticlo/core';
import {StaticFlowStorage, StaticStorage} from '../StaticStorage.ts';

const baseUrl = 'http://static.test';
const rootUrl = `${baseUrl}/proj/%23root`;

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
      [`${rootUrl}/%23storage/a%252fb%253fc%23%25%20d.str`]: 'value',
      [`${rootUrl}/%23storage/%2BtestNs.key.str`]: 'literal key',
      [`${baseUrl}/proj/testNs/%23libs/lib.%23.worker.ticlo`]: '{"worker":"test"}',
      [`${baseUrl}/proj/testNs/main.%23.worker.ticlo`]: '{"value":"subflow"}',
      [`${rootUrl}/%23libs/lib.ticlo`]: '{"worker":"root"}',
    });
    const storage = new StaticStorage(`${rootUrl}/%23storage/`, '.str');
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
        'folder/',
        'first.ticlo',
        '#global.ticlo',
        'first.#.worker.ticlo',
        '#libs/',
        'broken.ticlo',
        'notes.txt',
      ]),
      [`${rootUrl}/%23global.ticlo`]: encodeSorted({'#is': '', '^value': 42}),
      [`${rootUrl}/first.ticlo`]: encodeSorted({'#is': '', 'value': 1}),
      [`${rootUrl}/folder/.list.json`]: '["child.ticlo","flow.ticlo"]',
      [`${rootUrl}/folder/child.ticlo`]: encodeSorted({'#is': '', 'value': 2}),
      [`${rootUrl}/folder/flow.ticlo`]: encodeSorted({'#is': '', 'value': 3}),
      [`${rootUrl}/broken.ticlo`]: '{invalid',
    });
    root = new Root();
    const storage = new StaticFlowStorage(baseUrl);
    await root.setStorage(storage);
    await root.start({[storage.initialProject]: {flows: ['first', 'folder.**']}});

    expect(storage.inited).toBe(true);
    expect(root._globalRoot.getValue('^value')).toBe(42);
    expect(root.queryValue('first.value')).toBe(1);
    expect(root.queryValue('folder.child.value')).toBe(2);
    expect(root.queryValue('folder')).toBeInstanceOf(FlowFolder);
    expect(root.queryValue('folder.flow.value')).toBe(3);
    expect(fetchMock.mock.calls.map(([url]) => url).filter((url) => url.endsWith('.ticlo'))).toEqual([
      `${rootUrl}/%23global.ticlo`,
      `${rootUrl}/first.ticlo`,
      `${rootUrl}/folder/child.ticlo`,
      `${rootUrl}/folder/flow.ticlo`,
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

  it('loads empty and nested user folders, reserves system directories, and deletes folders only in memory', async () => {
    const files: Record<string, string> = {
      [`${rootUrl}/.list.json`]: '[]',
      [`${baseUrl}/proj/main/.list.json`]:
        '["libs/","deps/","storage/","_libs/","_deps/","_storage/","empty/","#libs/","#storage/"]',
      [`${baseUrl}/proj/main/empty/.list.json`]: '[]',
      [`${baseUrl}/proj/main/%23libs/tools.ticlo`]: encodeSorted({worker: 'library'}),
    };
    for (const name of ['libs', 'deps', 'storage', '_libs', '_deps', '_storage']) {
      files[`${baseUrl}/proj/main/${name}/.list.json`] = '["nested/"]';
      files[`${baseUrl}/proj/main/${name}/nested/.list.json`] = '["flow.ticlo"]';
      files[`${baseUrl}/proj/main/${name}/nested/flow.ticlo`] = encodeSorted({value: name});
    }
    mockFiles(files);
    root = new Root();
    const storage = new StaticFlowStorage(baseUrl, 'main');
    await root.setStorage(storage);
    await root.start({main: {flows: ['**']}});
    expect(root.queryValue('+main.empty')).toBeInstanceOf(FlowFolder);
    for (const name of ['libs', 'deps', 'storage', '_libs', '_deps', '_storage']) {
      expect(root.queryValue(`+main.${name}.nested.flow.value`)).toBe(name);
    }
    for (const name of ['#libs', '#deps', '#storage']) {
      expect(root.queryValue(`+main.${name}`)).toBeUndefined();
      expect(() => root.addFlowFolder(`+main.${name}`)).toThrow('Reserved folder');
    }
    const flow = root.queryValue('+main.libs.nested.flow') as Flow;
    flow.setValue('value', 'temporary');
    flow.applyChange();
    root.deleteFlow('+main.libs');
    expect(await storage.loadFlow('+main.libs.nested.flow')).toBeNull();
    expect(await storage.loadLib('+main', 'tools')).toEqual({worker: 'library'});
    root.destroy();
    root = new Root();
    await root.setStorage(new StaticFlowStorage(baseUrl, 'main'));
    await root.start({main: {flows: ['**']}});
    expect(root.queryValue('+main.libs.nested.flow.value')).toBe('libs');
  });

  it('loads only the selected project and recursive deps, with globals always from #root', async () => {
    const fetchMock = mockFiles({
      [`${rootUrl}/.list.json`]: '["#global.ticlo","unused.ticlo"]',
      [`${rootUrl}/%23global.ticlo`]: encodeSorted({'#is': '', '^value': 42}),
      [`${baseUrl}/proj/main/.list.json`]: JSON.stringify([
        'run.ticlo',
        'ticlo.json',
        '#libs/',
        '#global.ticlo',
        'bad:name.ticlo',
        'bad..name.ticlo',
        'bad/path.ticlo',
        '+other.ticlo',
        'run.#.worker.ticlo',
      ]),
      [`${baseUrl}/proj/main/ticlo.json`]: JSON.stringify({dependencies: ['shared', 'common']}),
      [`${baseUrl}/proj/main/run.ticlo`]: encodeSorted({value: 1}),
      [`${baseUrl}/proj/main/%23global.ticlo`]: encodeSorted({'^value': 99}),
      [`${baseUrl}/proj/shared/.list.json`]: '["folder/","ticlo.json"]',
      [`${baseUrl}/proj/shared/ticlo.json`]: JSON.stringify({dependencies: ['common']}),
      [`${baseUrl}/proj/shared/folder/.list.json`]: '["child.ticlo"]',
      [`${baseUrl}/proj/shared/folder/child.ticlo`]: encodeSorted({value: 2}),
      [`${baseUrl}/proj/common/.list.json`]: '["run.ticlo","ticlo.json"]',
      [`${baseUrl}/proj/common/ticlo.json`]: JSON.stringify({dependencies: ['main']}),
      [`${baseUrl}/proj/common/run.ticlo`]: encodeSorted({value: 3}),
      [`${baseUrl}/proj/unrelated/.list.json`]: '["run.ticlo"]',
    });
    root = new Root();
    const storage = new StaticFlowStorage(baseUrl, 'main');
    await root.setStorage(storage);
    await root.start({main: {flows: ['**']}});
    expect([...storage.projects].sort()).toEqual(['common', 'main', 'shared']);
    expect(root._globalRoot.getValue('^value')).toBe(42);
    expect(root.queryValue('+main.run.value')).toBe(1);
    expect(root.queryValue('+shared.folder.child.value')).toBeUndefined();
    expect(root.queryValue('+common.run.value')).toBeUndefined();
    expect(root.queryValue('unused')).toBeUndefined();
    expect(root.queryValue('+unrelated')).toBeUndefined();
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls.filter((url) => url.endsWith('.ticlo'))).toEqual([
      `${rootUrl}/%23global.ticlo`,
      `${baseUrl}/proj/main/run.ticlo`,
    ]);
    expect(urls.filter((url) => url === `${baseUrl}/proj/common/.list.json`)).toHaveLength(1);
  });

  it('keeps libraries separate from flows and retains temporary saves when a root shuts down', async () => {
    mockFiles({
      [`${rootUrl}/.list.json`]: '[]',
      [`${baseUrl}/proj/main/.list.json`]: '["same.ticlo","#libs/"]',
      [`${baseUrl}/proj/main/same.ticlo`]: encodeSorted({value: 'flow'}),
      [`${baseUrl}/proj/main/%23libs/same.ticlo`]: encodeSorted({value: 'library'}),
    });
    root = new Root();
    const storage = new StaticFlowStorage(baseUrl, 'main');
    await root.setStorage(storage);
    await root.start({main: {flows: ['**']}});
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

  it('enables #root dependencies without loading ordinary flows', async () => {
    mockFiles({
      [`${rootUrl}/.list.json`]: '["plain.ticlo"]',
      [`${rootUrl}/plain.ticlo`]: encodeSorted({value: 7}),
      [`${baseUrl}/proj/main/.list.json`]: '["ticlo.json"]',
      [`${baseUrl}/proj/main/ticlo.json`]: JSON.stringify({dependencies: ['#root']}),
    });
    root = new Root();
    await root.setStorage(new StaticFlowStorage(baseUrl, 'main'));
    await root.start({main: {}});
    expect(root.queryValue('plain.value')).toBeUndefined();
    expect(root.queryValue('+#root')).toBeUndefined();
  });

  it('rejects missing dependencies declared in project metadata', async () => {
    mockFiles({
      [`${rootUrl}/.list.json`]: '["ticlo.json"]',
      [`${rootUrl}/ticlo.json`]: JSON.stringify({dependencies: ['missing']}),
    });
    root = new Root();
    await root.setStorage(new StaticFlowStorage(baseUrl));
    await expect(root.start()).rejects.toThrow('HTTP 404');
    expect(root._lifecycle.started).toBe(false);
  });

  it.each([undefined, {}])('defaults to all #root flows and preserves disabled services (%j)', async (options) => {
    mockFiles({
      [`${rootUrl}/.list.json`]: '["ticlo.json", "#libs/", "entry.ticlo", "folder/"]',
      [`${rootUrl}/ticlo.json`]: JSON.stringify({serviceLibraries: ['service']}),
      [`${rootUrl}/%23libs/service.ticlo`]: JSON.stringify({'#disabled': true}),
      [`${rootUrl}/entry.ticlo`]: JSON.stringify({value: 1}),
      [`${rootUrl}/folder/.list.json`]: '["nested.ticlo"]',
      [`${rootUrl}/folder/nested.ticlo`]: JSON.stringify({value: 2}),
    });
    root = new Root();
    await root.setStorage(new StaticFlowStorage(baseUrl));
    await root.start(options);
    const ref = {namespace: '#root', kind: 'library', name: 'service'} as const;
    expect(root.getFlowState(ref)).toBe('disabled');
    expect(root.queryValue('entry.value')).toBe(1);
    expect(root.queryValue('folder.nested.value')).toBe(2);
    await expect(root.enableFlow(ref, {persist: true})).rejects.toThrow('persistence');
    await expect(root.setServiceLibrary('#root', 'service', false)).rejects.toThrow('persistence');
    await root.enableFlow(ref);
    expect(root.getFlowState(ref)).toBe('enabled');
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
