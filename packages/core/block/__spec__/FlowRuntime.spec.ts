import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import '../../index.ts';
import {Flow, Root} from '../Flow.ts';
import {MemoryFlowStorage} from '../MemoryFlowStorage.ts';
import type {FlowRef} from '../FlowRuntime.ts';
import {Library} from '../Library.ts';
import {shouldHappen} from '../../util/test-util.ts';
import {makeLocalConnection} from '../../connect/LocalConnection.ts';

const ref = (library: string, name: string, kind: 'flow' | 'module' = 'flow'): FlowRef => ({library, name, kind});
const moduleData = {
  '#is': '',
  '#functions': {
    ':value': {
      type: 'worker',
      worker: {
        '#is': '',
        '#outputs': {'#is': 'flow:outputs', '#output': 42},
      },
    },
  },
};

describe('runtime lifecycle', () => {
  let root: Root;
  let storage: MemoryFlowStorage;
  beforeEach(async () => {
    root = new Root();
    storage = new MemoryFlowStorage();
    await storage.saveLibraryMetadata('main', {});
    await storage.saveLibraryMetadata('shared', {});
    await root.setStorage(storage);
  });
  afterEach(async () => {
    await root.stop({discardChanges: true});
    root.destroy();
  });

  it.each([undefined, {}])('defaults to all #root flows and services (%j)', async (options) => {
    await storage.saveLibraryMetadata('#root', {autoLoadModules: ['service']});
    storage.saveModule('', 'service', moduleData);
    storage.saveFlow(null, {value: 1}, 'entry');
    storage.saveFlow(null, {'#disabled': true, 'value': 2}, 'folder.nested');
    storage.saveFlow(null, {}, '+main.entry');
    const read = vi.spyOn(storage, 'loadFlow');
    await root.start(options);
    expect(root.getFlowState(ref('#root', 'entry'))).toBe('enabled');
    expect(root.queryValue('folder.nested.value')).toBe(2);
    expect(root.getFlowState(ref('#root', 'folder.nested'))).toBe('disabled');
    expect(root.getFlowState(ref('#root', 'service', 'module'))).toBe('enabled');
    expect(read).toHaveBeenCalledWith('entry');
    expect(read).not.toHaveBeenCalledWith('+main.entry');
    expect(root.getValue('+#root')).toBeUndefined();
    await root.stop();
    await root.start({'#root': {}});
    expect(root.getFlowState(ref('#root', 'entry'))).toBe('unloaded');
    expect(root.getFlowState(ref('#root', 'folder.nested'))).toBe('unloaded');
  });

  it('starts global functions after dependency discovery and releases them on stop', async () => {
    const service = root._globalRoot.createBlock('^service');
    service._load({'#is': 'add', '0': 2, '1': 3});
    const disabled = root._globalRoot.createBlock('^disabled');
    disabled._load({'#is': 'add', '#disabled': true, '0': 1, '1': 2});
    root.runAll();
    expect(service.getValue('#output')).toBeUndefined();

    await storage.saveLibraryMetadata('main', {dependencies: ['missing']});
    await expect(root.start({main: {}})).rejects.toThrow('Missing library');
    root.runAll();
    expect(service.getValue('#output')).toBeUndefined();

    await storage.saveLibraryMetadata('main', {});
    await root.start({main: {}});
    await shouldHappen(() => service.getValue('#output') === 5);
    expect(disabled.getValue('#output')).toBeUndefined();
    await root.stop();
    expect(service.getValue('#output')).toBeUndefined();
    await root.start({main: {}});
    await shouldHappen(() => service.getValue('#output') === 5);
    expect(disabled.getValue('#output')).toBeUndefined();
  });

  it('allows destruction while stop is unloading flows', async () => {
    await root.start();
    root.addFlow('entry', {});
    const stopping = root.stop({discardChanges: true});
    root.destroy();
    await stopping;
  });

  it('cancels startup while storage is reading root metadata', async () => {
    let resolve: (metadata: object) => void;
    vi.spyOn(storage, 'getLibraryMetadata').mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const starting = root.start();
    await root.stop();
    resolve({});
    await expect(starting).rejects.toThrow('cancelled');
    expect(Library.getLibrary('+#root', root)._enabled).toBe(false);
    expect(root._lifecycle.started).toBe(false);
  });

  it('uses policy globs per library and enables cyclic dependencies without ordinary dependency flows', async () => {
    await storage.saveLibraryMetadata('main', {dependencies: ['shared']});
    await storage.saveLibraryMetadata('shared', {dependencies: ['main'], autoLoadModules: ['service']});
    storage.saveModule('+shared', 'service', moduleData);
    for (const name of ['entry', 'jobs.one', 'jobs.nested.two', 'worker12', 'workerX'])
      storage.saveFlow(null, {value: name}, `+main.${name}`);
    storage.saveFlow(null, {value: 'unused'}, '+shared.entry');
    const read = vi.spyOn(storage, 'loadFlow');
    await root.start({main: {flows: ['entry', 'jobs.**', 'worker?']}, shared: {}});
    expect(root.queryValue('+main.jobs.nested.two.value')).toBe('jobs.nested.two');
    expect(root.queryValue('+main.worker12.value')).toBe('worker12');
    expect(read).not.toHaveBeenCalledWith('+main.workerX');
    expect(read).not.toHaveBeenCalledWith('+shared.entry');
    expect(root.getFlowState(ref('shared', 'service', 'module'))).toBe('enabled');
    await expect(root.disableLibrary('shared')).rejects.toThrow('depends on');
    await root.disableLibrary('shared', {cascade: true});
    expect(root.getFlowState(ref('main', 'entry'))).toBe('unloaded');
  });

  it('loads auto-load flows only for main roots and leaves manually opened dependency flows running', async () => {
    await storage.saveLibraryMetadata('main', {dependencies: ['shared'], autoLoadFlows: ['entry']});
    await storage.saveLibraryMetadata('shared', {autoLoadFlows: ['entry']});
    storage.saveFlow(null, {value: 'main'}, '+main.entry');
    storage.saveFlow(null, {value: 'shared'}, '+shared.entry');
    storage.saveFlow(null, {value: 'other'}, '+main.other');

    await root.start({main: {}});
    expect(root.getFlowState(ref('main', 'entry'))).toBe('enabled');
    expect(root.getFlowState(ref('main', 'other'))).toBe('unloaded');
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('unloaded');
    expect(await root.listMainFlows()).toEqual([
      {library: 'main', name: 'entry', state: 'enabled', autoLoad: true, canAutoLoad: true},
      {library: 'main', name: 'other', state: 'unloaded', autoLoad: false, canAutoLoad: true},
    ]);

    await root.enableLibrary('shared');
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('enabled');
    const shared = root.queryValue('+shared.entry') as Flow;
    shared.setValue('value', 'edited');
    shared.trackChange();
    await expect(root.retainLibraries(['main'])).rejects.toThrow('unsaved changes');
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('enabled');
    await shared.applyChange();
    await root.retainLibraries(['main']);
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('unloaded');

    await root.loadFlow(ref('shared', 'entry'));
    await root.enableLibrary('shared');
    await root.retainLibraries(['main']);
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('enabled');
  });

  it('uses explicit flow selection instead of auto-load flows and applies flag changes only to main roots', async () => {
    await storage.saveLibraryMetadata('main', {dependencies: ['shared'], autoLoadFlows: ['entry']});
    await storage.saveLibraryMetadata('shared', {autoLoadFlows: ['entry']});
    storage.saveFlow(null, {value: 1}, '+main.entry');
    storage.saveFlow(null, {value: 2}, '+main.other');
    storage.saveFlow(null, {value: 3}, '+shared.entry');

    await root.start({main: {flows: ['other']}});
    expect(root.getFlowState(ref('main', 'entry'))).toBe('unloaded');
    expect(root.getFlowState(ref('main', 'other'))).toBe('enabled');
    await root.setAutoLoadFlow('shared', 'entry', true);
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('unloaded');
    await root.setAutoLoadFlow('main', 'entry', true);
    expect(root.getFlowState(ref('main', 'entry'))).toBe('enabled');
    await root.setAutoLoadFlow('main', 'entry', false);
    expect(root.getFlowState(ref('main', 'entry'))).toBe('enabled');
    expect((await storage.getLibraryMetadata('main')).autoLoadFlows).toEqual([]);
  });

  it('switches libraries while retaining shared dependencies and rejecting unsaved changes', async () => {
    await storage.saveLibraryMetadata('main', {dependencies: ['shared']});
    await storage.saveLibraryMetadata('other', {dependencies: ['shared']});
    await storage.saveLibraryMetadata('dependent', {dependencies: ['other']});
    storage.saveFlow(null, {value: 1}, '+main.entry');
    storage.saveFlow(null, {value: 2}, '+shared.entry');
    storage.saveFlow(null, {value: 3}, '+other.entry');
    await root.start({main: {flows: ['entry']}, shared: {flows: ['entry']}});
    const main = await root.loadFlow(ref('main', 'entry'));
    const shared = await root.loadFlow(ref('shared', 'entry'));
    main.setValue('value', 4);
    main.trackChange();

    await expect(root.switchLibrary('other')).rejects.toThrow('unsaved changes');
    expect(root.getFlowState(ref('main', 'entry'))).toBe('enabled');
    expect(Library.getLibrary('+other', root)._enabled).toBe(false);

    await main.applyChange();
    await root.switchLibrary('other');
    expect(root.getFlowState(ref('main', 'entry'))).toBe('unloaded');
    expect(root.queryValue('+shared.entry')).toBe(shared);
    expect(Library.getLibrary('+other', root)._enabled).toBe(true);
    expect(root.getFlowState(ref('other', 'entry'))).toBe('unloaded');

    const other = await root.loadFlow(ref('other', 'entry'));
    await root.switchLibrary('dependent');
    expect(root.queryValue('+other.entry')).toBe(other);
    expect(root.queryValue('+shared.entry')).toBe(shared);
    expect(Library.getLibrary('+dependent', root)._enabled).toBe(true);
  });

  it('tracks manually loaded roots and retains dependencies shared by other roots', async () => {
    await storage.saveLibraryMetadata('main', {dependencies: ['shared']});
    await storage.saveLibraryMetadata('other', {dependencies: ['shared']});
    await storage.saveLibraryMetadata('shared', {dependencies: ['main']});
    storage.saveFlow(null, {value: 1}, '+main.entry');
    await root.start({main: {flows: ['entry']}});
    await root.enableLibrary('other');
    expect(root.getLibraryGraph()).toEqual({
      roots: ['main', 'other'],
      dependencies: {main: ['shared'], shared: ['main'], other: ['shared']},
    });

    await root.unloadLibrary('main');
    expect(root.getLibraryGraph().roots).toEqual(['other']);
    expect(root.getFlowState(ref('main', 'entry'))).toBe('unloaded');

    await root.unloadLibrary('other');
    expect(root.getLibraryGraph()).toEqual({roots: [], dependencies: {}});
    expect(root.getFlowState(ref('main', 'entry'))).toBe('unloaded');
  });

  it('lists only active libraries after unloading other roots', async () => {
    await storage.saveLibraryMetadata('main', {dependencies: ['shared']});
    await storage.saveLibraryMetadata('other', {dependencies: ['shared']});
    await root.start({main: {}});
    await root.enableLibrary('other');
    const [, client] = makeLocalConnection(root);
    try {
      const listed = async () => Object.keys((await client.list('', null, 64)).children);
      expect(await listed()).toEqual(expect.arrayContaining(['+main', '+other', '+shared']));

      await root.retainLibraries(['other']);
      expect(root.queryValue('+main')).toBeTruthy();
      expect(await listed()).not.toContain('+main');
      expect(await listed()).toEqual(expect.arrayContaining(['+other', '+shared']));

      await root.enableLibrary('main');
      expect(await listed()).toContain('+main');
    } finally {
      client.destroy();
    }
  });

  it('checks every removed root for unsaved changes before retaining a selection', async () => {
    storage.saveFlow(null, {value: 1}, '+main.entry');
    await root.start({main: {flows: ['entry']}});
    await root.enableLibrary('shared');
    const flow = root.queryValue('+main.entry') as Flow;
    flow.setValue('value', 2);
    flow.trackChange();

    await expect(root.retainLibraries(['shared'])).rejects.toThrow('unsaved changes');
    expect(root.getLibraryGraph().roots).toEqual(['main', 'shared']);
    expect(root.getFlowState(ref('main', 'entry'))).toBe('enabled');
  });

  it('updates active library dependencies without unloading its flows', async () => {
    await storage.saveLibraryMetadata('main', {dependencies: ['shared'], autoLoadModules: ['service']});
    await storage.saveLibraryMetadata('other', {});
    storage.saveModule('+main', 'service', moduleData);
    storage.saveFlow(null, {value: 1}, '+main.entry');
    storage.saveFlow(null, {value: 2}, '+shared.entry');
    await root.start({main: {flows: ['entry']}});
    const main = await root.loadFlow(ref('main', 'entry'));
    const shared = await root.loadFlow(ref('shared', 'entry'));
    shared.setValue('value', 3);
    shared.trackChange();

    await expect(root.setLibraryDependencies('main', ['other'])).rejects.toThrow('unsaved changes');
    expect((await storage.getLibraryMetadata('main')).dependencies).toEqual(['shared']);
    expect(Library.getLibrary('+other', root)._enabled).toBe(false);

    await shared.applyChange();
    vi.spyOn(storage, 'saveLibraryMetadata').mockRejectedValueOnce(new Error('write failed'));
    await expect(root.setLibraryDependencies('main', ['other'])).rejects.toThrow('write failed');
    expect(Library.getLibrary('+other', root)._enabled).toBe(false);
    expect((await storage.getLibraryMetadata('main')).dependencies).toEqual(['shared']);

    await root.setLibraryDependencies('main', ['other']);
    expect(root.queryValue('+main.entry')).toBe(main);
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('unloaded');
    expect(Library.getLibrary('+other', root)._enabled).toBe(true);
    expect(await storage.getLibraryMetadata('main')).toEqual({
      dependencies: ['other'],
      autoLoadModules: ['service'],
    });
  });

  it('keeps inactive modules empty, lazily loads on activation, and rebinds after disable and unload', async () => {
    storage.saveModule('+shared', 'tools', moduleData);
    storage.saveFlow(
      null,
      {'#is': '', 'call': {'#is': '+shared:tools:value'}, 'repeat': {'#is': 'worker', '#use': '+shared:tools:value'}},
      '+main.entry'
    );
    const read = vi.spyOn(storage, 'loadModule');
    await root.start({main: {flows: ['entry']}});
    root.runAll();
    expect(read).not.toHaveBeenCalled();
    expect(root.queryValue('+main.entry.call.#output')).toBeUndefined();
    await root.enableLibrary('shared');
    await shouldHappen(() => root.getFlowState(ref('shared', 'tools', 'module')) === 'enabled');
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBe(42);
    expect(root.queryValue('+main.entry.repeat.#output')).toBe(42);
    const module = ref('shared', 'tools', 'module');
    await root.disableFlow(module);
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBeUndefined();
    expect(root.queryValue('+main.entry.repeat.#output')).toBeUndefined();
    await root.enableFlow(module);
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBe(42);
    await root.unloadFlow(module);
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBeUndefined();
    Library.getFunctionModule('+shared:tools:value', root);
    expect(root.getFlowState(module)).toBe('unloaded');
    await root.loadFlow(module);
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBe(42);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('honors persisted disabled before function construction and keeps temporary state out of saves', async () => {
    storage.saveFlow(null, {'#is': '', 'fn': {'#is': 'add', 0: 1, 1: 2}, '#disabled': true}, '+main.entry');
    await root.start({main: {flows: ['entry']}});
    const entry = ref('main', 'entry');
    root.runAll();
    expect(root.queryValue('+main.entry.fn.#output')).toBeUndefined();
    await root.enableFlow(entry);
    root.runAll();
    expect(root.queryValue('+main.entry.fn.#output')).toBe(3);
    const flow = await root.loadFlow(entry);
    await flow.applyChange();
    expect((await storage.loadFlow('+main.entry'))['#disabled']).toBe(true);
    await root.enableFlow(entry, {persist: true});
    await root.stop();
    await root.start({main: {}});
    expect(root.getFlowState(entry)).toBe('unloaded');
    await root.loadFlow(entry);
    expect(root.getFlowState(entry)).toBe('enabled');
    await root.disableFlow(entry, {persist: true});
    await root.unloadFlow(entry);
    await root.loadFlow(entry);
    expect(root.getFlowState(entry)).toBe('disabled');
  });

  it('loads a disabled service but never exposes its functions', async () => {
    await storage.saveLibraryMetadata('main', {autoLoadModules: ['service']});
    storage.saveModule('+main', 'service', {...moduleData, '#disabled': true});
    await root.start({main: {}});
    expect(root.getFlowState(ref('main', 'service', 'module'))).toBe('disabled');
    expect(Library.getFunctionModule('+main:service:value', root).getWorkerData('+main:service:value')).toBeNull();
  });

  it('persists auto-load selection for one library and applies changes immediately', async () => {
    storage.saveModule('+main', 'tools', moduleData);
    storage.saveModule('+shared', 'tools', moduleData);
    await root.start({main: {}, shared: {}});
    expect(root.getFlowState(ref('main', 'tools', 'module'))).toBe('unloaded');

    await root.setAutoLoadModule('main', 'tools', true);
    expect(await storage.getLibraryMetadata('main')).toEqual({autoLoadModules: ['tools']});
    expect(await storage.getLibraryMetadata('shared')).toEqual({});
    expect(root.getFlowState(ref('main', 'tools', 'module'))).toBe('enabled');
    expect(root.getFlowState(ref('shared', 'tools', 'module'))).toBe('unloaded');

    await root.setAutoLoadModule('main', 'tools', false);
    expect(root.getFlowState(ref('main', 'tools', 'module'))).toBe('enabled');
    await root.stop();
    await root.start({main: {}, shared: {}});
    expect(root.getFlowState(ref('main', 'tools', 'module'))).toBe('unloaded');
  });

  it('isolates caller disable from the module and other callers, including relative references', async () => {
    storage.saveModule('+main', 'tools', moduleData);
    for (const name of ['first', 'second']) {
      storage.saveFlow(
        null,
        {'#is': '', 'call': {'#is': '+main:tools:value'}, 'repeat': {'#is': 'worker', '#use': '+:tools:value'}},
        `+main.${name}`
      );
    }
    await root.start({main: {flows: ['*']}});
    await root.loadFlow(ref('main', 'tools', 'module'));
    root.runAll();
    expect(root.queryValue('+main.first.repeat.#worker.#+')).toBe(root.getValue('+main'));
    await root.disableFlow(ref('main', 'first'));
    root.runAll();
    expect(Library.getFunctionModule('+main:tools:value', root).getWorkerData('+main:tools:value')).toBeTruthy();
    expect(root.queryValue('+main.second.call.#output')).toBe(42);
    expect(root.queryValue('+main.second.repeat.#output')).toBe(42);
    await root.enableFlow(ref('main', 'first'));
    root.runAll();
    expect(root.queryValue('+main.first.repeat.#output')).toBe(42);
  });

  it('binds root and named library context to the owning runtime', async () => {
    storage.saveFlow(null, {'#is': '', 'child': {'#is': ''}}, 'entry');
    await root.start({'#root': {flows: ['entry']}, 'main': {}});
    expect(root.queryValue('entry.child.#+')).toBe(root);
    expect(root.queryValue('entry.child.#+main')).toBe(root.getValue('+main'));
  });

  it('tracks newly created modules and preserves existing subscriptions', async () => {
    storage.saveFlow(null, {'#is': '', 'call': {'#is': '+main:tools:value'}}, '+main.entry');
    await root.start({main: {flows: ['entry']}});
    await shouldHappen(() => root.getFlowState(ref('main', 'tools', 'module')) === 'unloaded');
    root.addFlow('+main.:tools', moduleData);
    root.runAll();
    expect(root.getFlowState(ref('main', 'tools', 'module'))).toBe('enabled');
    expect(root.queryValue('+main.entry.call.#output')).toBe(42);
    await root.unloadFlow(ref('main', 'tools', 'module'));
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBeUndefined();
    await root.loadFlow(ref('main', 'tools', 'module'));
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBe(42);
  });

  it('cancels library activation while its metadata is still being read', async () => {
    await root.start();
    let resolve: (data: object) => void;
    vi.spyOn(storage, 'getLibraryMetadata').mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const enabling = root.enableLibrary('main');
    await root.disableLibrary('main');
    resolve({autoLoadModules: ['service']});
    await expect(enabling).rejects.toThrow('cancelled');
    expect(Library.getLibrary('+main', root)._enabled).toBe(false);
    expect(root.getFlowState(ref('main', 'service', 'module'))).toBe('unloaded');
    await root.enableLibrary('main');
    expect(Library.getLibrary('+main', root)._enabled).toBe(true);
  });

  it('cancels pending loads on library disable even if the library is reenabled', async () => {
    await root.start({main: {}});
    let resolve: (data: object) => void;
    vi.spyOn(storage, 'loadFlow').mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const loading = root.loadFlow(ref('main', 'entry'));
    await Promise.resolve();
    await root.disableLibrary('main');
    await root.enableLibrary('main');
    resolve({value: 1});
    await expect(loading).rejects.toThrow('cancelled');
    expect(root.queryValue('+main.entry')).toBeUndefined();
  });

  it('rejects dirty unloads and persists only the disabled flag', async () => {
    storage.saveFlow(null, {value: 1}, '+main.entry');
    await root.start({main: {flows: ['entry']}});
    const entry = ref('main', 'entry');
    const flow = await root.loadFlow(entry);
    flow.setValue('value', 2);
    flow.trackChange();
    await expect(root.unloadFlow(entry)).rejects.toThrow('unsaved changes');
    await root.disableFlow(entry, {persist: true});
    expect((await storage.loadFlow('+main.entry')).value).toBe(1);
    expect(flow.getValue('value')).toBe(2);
    await expect(root.stop()).rejects.toThrow('unsaved changes');
    await root.unloadFlow(entry, {discardChanges: true});
    await root.loadFlow(entry);
    expect(root.queryValue('+main.entry.value')).toBe(1);
    expect(root.getFlowState(entry)).toBe('disabled');
  });

  it('does not publish pending loads after stop', async () => {
    await root.start({main: {}});
    let resolve: (data: object) => void;
    vi.spyOn(storage, 'loadFlow').mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const loading = root.loadFlow(ref('main', 'entry'));
    await Promise.resolve();
    await root.stop();
    resolve({value: 1});
    await expect(loading).rejects.toThrow('cancelled');
    expect(root.queryValue('+main.entry')).toBeUndefined();
  });

  it('does not share library modules between roots', async () => {
    storage.saveModule('+main', 'tools', moduleData);
    await root.start({main: {}});
    const other = new Root();
    await other.setStorage(storage);
    await other.start({shared: {}});
    await root.loadFlow(ref('main', 'tools', 'module'));
    expect(Library.getFunctionModule('+main:tools:value', other).getWorkerData('+main:tools:value')).toBeNull();
    await other.stop();
    other.destroy();
  });

  it('fails missing dependencies before loading flows and can start again', async () => {
    await storage.saveLibraryMetadata('main', {dependencies: ['missing']});
    await expect(root.start({main: {}})).rejects.toThrow('Missing library');
    await root.start();
    expect(root._lifecycle.started).toBe(true);
  });

  it('rolls back failed service activation and retries without stopping other libraries', async () => {
    await root.start({shared: {}});
    await storage.saveLibraryMetadata('main', {autoLoadModules: ['service']});
    await expect(root.enableLibrary('main')).rejects.toThrow('Missing module');
    expect(Library.getLibrary('+main', root)._enabled).toBe(false);
    expect(Library.getLibrary('+shared', root)._enabled).toBe(true);
    storage.saveModule('+main', 'service', {...moduleData, startup: {'#is': 'add', 0: 10, 1: 20}});
    await root.enableLibrary('main');
    root.runAll();
    expect(root.queryValue('+main.:service.startup.#output')).toBe(30);
    expect(root.getFlowState(ref('main', 'service', 'module'))).toBe('enabled');
  });
});
