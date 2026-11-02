import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import '../../index.ts';
import {Flow, Root} from '../Flow.ts';
import {MemoryFlowStorage} from '../MemoryFlowStorage.ts';
import type {FlowRef} from '../FlowRuntime.ts';
import {Namespace} from '../Namespace.ts';
import {shouldHappen} from '../../util/test-util.ts';
import {makeLocalConnection} from '../../connect/LocalConnection.ts';

const ref = (namespace: string, name: string, kind: 'flow' | 'library' = 'flow'): FlowRef => ({namespace, name, kind});
const libData = {
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
    await storage.saveNamespaceMetadata('main', {});
    await storage.saveNamespaceMetadata('shared', {});
    await root.setStorage(storage);
  });
  afterEach(async () => {
    await root.stop({discardChanges: true});
    root.destroy();
  });

  it.each([undefined, {}])('defaults to all #root flows and services (%j)', async (options) => {
    await storage.saveNamespaceMetadata('#root', {autoLoadLibraries: ['service']});
    storage.saveLib('', 'service', libData);
    storage.saveFlow(null, {value: 1}, 'entry');
    storage.saveFlow(null, {'#disabled': true, 'value': 2}, 'folder.nested');
    storage.saveFlow(null, {}, '+main.entry');
    const read = vi.spyOn(storage, 'loadFlow');
    await root.start(options);
    expect(root.getFlowState(ref('#root', 'entry'))).toBe('enabled');
    expect(root.queryValue('folder.nested.value')).toBe(2);
    expect(root.getFlowState(ref('#root', 'folder.nested'))).toBe('disabled');
    expect(root.getFlowState(ref('#root', 'service', 'library'))).toBe('enabled');
    expect(read).toHaveBeenCalledWith('entry');
    expect(read).not.toHaveBeenCalledWith('+main.entry');
    expect(root.getValue('+#root')).toBeUndefined();
    await root.stop();
    await root.start({'#root': {}});
    expect(root.getFlowState(ref('#root', 'entry'))).toBe('unloaded');
    expect(root.getFlowState(ref('#root', 'folder.nested'))).toBe('unloaded');
  });

  it('cancels startup while storage is reading root metadata', async () => {
    let resolve: (metadata: object) => void;
    vi.spyOn(storage, 'getNamespaceMetadata').mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const starting = root.start();
    await root.stop();
    resolve({});
    await expect(starting).rejects.toThrow('cancelled');
    expect(Namespace.getNameSpace('+#root', root)._enabled).toBe(false);
    expect(root._lifecycle.started).toBe(false);
  });

  it('uses policy globs per namespace and enables cyclic dependencies without ordinary dependency flows', async () => {
    await storage.saveNamespaceMetadata('main', {dependencies: ['shared']});
    await storage.saveNamespaceMetadata('shared', {dependencies: ['main'], autoLoadLibraries: ['service']});
    storage.saveLib('+shared', 'service', libData);
    for (const name of ['entry', 'jobs.one', 'jobs.nested.two', 'worker12', 'workerX'])
      storage.saveFlow(null, {value: name}, `+main.${name}`);
    storage.saveFlow(null, {value: 'unused'}, '+shared.entry');
    const read = vi.spyOn(storage, 'loadFlow');
    await root.start({main: {flows: ['entry', 'jobs.**', 'worker?']}, shared: {}});
    expect(root.queryValue('+main.jobs.nested.two.value')).toBe('jobs.nested.two');
    expect(root.queryValue('+main.worker12.value')).toBe('worker12');
    expect(read).not.toHaveBeenCalledWith('+main.workerX');
    expect(read).not.toHaveBeenCalledWith('+shared.entry');
    expect(root.getFlowState(ref('shared', 'service', 'library'))).toBe('enabled');
    await expect(root.disableNamespace('shared')).rejects.toThrow('depends on');
    await root.disableNamespace('shared', {cascade: true});
    expect(root.getFlowState(ref('main', 'entry'))).toBe('unloaded');
  });

  it('loads auto-load flows only for main roots and leaves manually opened dependency flows running', async () => {
    await storage.saveNamespaceMetadata('main', {dependencies: ['shared'], autoLoadFlows: ['entry']});
    await storage.saveNamespaceMetadata('shared', {autoLoadFlows: ['entry']});
    storage.saveFlow(null, {value: 'main'}, '+main.entry');
    storage.saveFlow(null, {value: 'shared'}, '+shared.entry');
    storage.saveFlow(null, {value: 'other'}, '+main.other');

    await root.start({main: {}});
    expect(root.getFlowState(ref('main', 'entry'))).toBe('enabled');
    expect(root.getFlowState(ref('main', 'other'))).toBe('unloaded');
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('unloaded');
    expect(await root.listMainFlows()).toEqual([
      {namespace: 'main', name: 'entry', state: 'enabled', autoLoad: true, canAutoLoad: true},
      {namespace: 'main', name: 'other', state: 'unloaded', autoLoad: false, canAutoLoad: true},
    ]);

    await root.enableNamespace('shared');
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('enabled');
    const shared = root.queryValue('+shared.entry') as Flow;
    shared.setValue('value', 'edited');
    shared.trackChange();
    await expect(root.retainNamespaces(['main'])).rejects.toThrow('unsaved changes');
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('enabled');
    await shared.applyChange();
    await root.retainNamespaces(['main']);
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('unloaded');

    await root.loadFlow(ref('shared', 'entry'));
    await root.enableNamespace('shared');
    await root.retainNamespaces(['main']);
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('enabled');
  });

  it('uses explicit flow selection instead of auto-load flows and applies flag changes only to main roots', async () => {
    await storage.saveNamespaceMetadata('main', {dependencies: ['shared'], autoLoadFlows: ['entry']});
    await storage.saveNamespaceMetadata('shared', {autoLoadFlows: ['entry']});
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
    expect((await storage.getNamespaceMetadata('main')).autoLoadFlows).toEqual([]);
  });

  it('switches namespaces while retaining shared dependencies and rejecting unsaved changes', async () => {
    await storage.saveNamespaceMetadata('main', {dependencies: ['shared']});
    await storage.saveNamespaceMetadata('other', {dependencies: ['shared']});
    await storage.saveNamespaceMetadata('dependent', {dependencies: ['other']});
    storage.saveFlow(null, {value: 1}, '+main.entry');
    storage.saveFlow(null, {value: 2}, '+shared.entry');
    storage.saveFlow(null, {value: 3}, '+other.entry');
    await root.start({main: {flows: ['entry']}, shared: {flows: ['entry']}});
    const main = await root.loadFlow(ref('main', 'entry'));
    const shared = await root.loadFlow(ref('shared', 'entry'));
    main.setValue('value', 4);
    main.trackChange();

    await expect(root.switchNamespace('other')).rejects.toThrow('unsaved changes');
    expect(root.getFlowState(ref('main', 'entry'))).toBe('enabled');
    expect(Namespace.getNameSpace('+other', root)._enabled).toBe(false);

    await main.applyChange();
    await root.switchNamespace('other');
    expect(root.getFlowState(ref('main', 'entry'))).toBe('unloaded');
    expect(root.queryValue('+shared.entry')).toBe(shared);
    expect(Namespace.getNameSpace('+other', root)._enabled).toBe(true);
    expect(root.getFlowState(ref('other', 'entry'))).toBe('unloaded');

    const other = await root.loadFlow(ref('other', 'entry'));
    await root.switchNamespace('dependent');
    expect(root.queryValue('+other.entry')).toBe(other);
    expect(root.queryValue('+shared.entry')).toBe(shared);
    expect(Namespace.getNameSpace('+dependent', root)._enabled).toBe(true);
  });

  it('tracks manually loaded roots and retains dependencies shared by other roots', async () => {
    await storage.saveNamespaceMetadata('main', {dependencies: ['shared']});
    await storage.saveNamespaceMetadata('other', {dependencies: ['shared']});
    await storage.saveNamespaceMetadata('shared', {dependencies: ['main']});
    storage.saveFlow(null, {value: 1}, '+main.entry');
    await root.start({main: {flows: ['entry']}});
    await root.enableNamespace('other');
    expect(root.getNamespaceGraph()).toEqual({
      roots: ['main', 'other'],
      dependencies: {main: ['shared'], shared: ['main'], other: ['shared']},
    });

    await root.unloadNamespace('main');
    expect(root.getNamespaceGraph().roots).toEqual(['other']);
    expect(root.getFlowState(ref('main', 'entry'))).toBe('unloaded');

    await root.unloadNamespace('other');
    expect(root.getNamespaceGraph()).toEqual({roots: [], dependencies: {}});
    expect(root.getFlowState(ref('main', 'entry'))).toBe('unloaded');
  });

  it('lists only active namespaces after unloading other roots', async () => {
    await storage.saveNamespaceMetadata('main', {dependencies: ['shared']});
    await storage.saveNamespaceMetadata('other', {dependencies: ['shared']});
    await root.start({main: {}});
    await root.enableNamespace('other');
    const [, client] = makeLocalConnection(root);
    try {
      const listed = async () => Object.keys((await client.list('', null, 64)).children);
      expect(await listed()).toEqual(expect.arrayContaining(['+main', '+other', '+shared']));

      await root.retainNamespaces(['other']);
      expect(root.queryValue('+main')).toBeTruthy();
      expect(await listed()).not.toContain('+main');
      expect(await listed()).toEqual(expect.arrayContaining(['+other', '+shared']));

      await root.enableNamespace('main');
      expect(await listed()).toContain('+main');
    } finally {
      client.destroy();
    }
  });

  it('checks every removed root for unsaved changes before retaining a selection', async () => {
    storage.saveFlow(null, {value: 1}, '+main.entry');
    await root.start({main: {flows: ['entry']}});
    await root.enableNamespace('shared');
    const flow = root.queryValue('+main.entry') as Flow;
    flow.setValue('value', 2);
    flow.trackChange();

    await expect(root.retainNamespaces(['shared'])).rejects.toThrow('unsaved changes');
    expect(root.getNamespaceGraph().roots).toEqual(['main', 'shared']);
    expect(root.getFlowState(ref('main', 'entry'))).toBe('enabled');
  });

  it('updates active namespace dependencies without unloading its flows', async () => {
    await storage.saveNamespaceMetadata('main', {dependencies: ['shared'], autoLoadLibraries: ['service']});
    await storage.saveNamespaceMetadata('other', {});
    storage.saveLib('+main', 'service', libData);
    storage.saveFlow(null, {value: 1}, '+main.entry');
    storage.saveFlow(null, {value: 2}, '+shared.entry');
    await root.start({main: {flows: ['entry']}});
    const main = await root.loadFlow(ref('main', 'entry'));
    const shared = await root.loadFlow(ref('shared', 'entry'));
    shared.setValue('value', 3);
    shared.trackChange();

    await expect(root.setNamespaceDependencies('main', ['other'])).rejects.toThrow('unsaved changes');
    expect((await storage.getNamespaceMetadata('main')).dependencies).toEqual(['shared']);
    expect(Namespace.getNameSpace('+other', root)._enabled).toBe(false);

    await shared.applyChange();
    vi.spyOn(storage, 'saveNamespaceMetadata').mockRejectedValueOnce(new Error('write failed'));
    await expect(root.setNamespaceDependencies('main', ['other'])).rejects.toThrow('write failed');
    expect(Namespace.getNameSpace('+other', root)._enabled).toBe(false);
    expect((await storage.getNamespaceMetadata('main')).dependencies).toEqual(['shared']);

    await root.setNamespaceDependencies('main', ['other']);
    expect(root.queryValue('+main.entry')).toBe(main);
    expect(root.getFlowState(ref('shared', 'entry'))).toBe('unloaded');
    expect(Namespace.getNameSpace('+other', root)._enabled).toBe(true);
    expect(await storage.getNamespaceMetadata('main')).toEqual({
      dependencies: ['other'],
      autoLoadLibraries: ['service'],
    });
  });

  it('keeps inactive libraries empty, lazily loads on activation, and rebinds after disable and unload', async () => {
    storage.saveLib('+shared', 'tools', libData);
    storage.saveFlow(
      null,
      {'#is': '', 'call': {'#is': '+shared:tools:value'}, 'repeat': {'#is': 'worker', '#use': '+shared:tools:value'}},
      '+main.entry'
    );
    const read = vi.spyOn(storage, 'loadLib');
    await root.start({main: {flows: ['entry']}});
    root.runAll();
    expect(read).not.toHaveBeenCalled();
    expect(root.queryValue('+main.entry.call.#output')).toBeUndefined();
    await root.enableNamespace('shared');
    await shouldHappen(() => root.getFlowState(ref('shared', 'tools', 'library')) === 'enabled');
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBe(42);
    expect(root.queryValue('+main.entry.repeat.#output')).toBe(42);
    const library = ref('shared', 'tools', 'library');
    await root.disableFlow(library);
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBeUndefined();
    expect(root.queryValue('+main.entry.repeat.#output')).toBeUndefined();
    await root.enableFlow(library);
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBe(42);
    await root.unloadFlow(library);
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBeUndefined();
    Namespace.getFunctionLib('+shared:tools:value', root);
    expect(root.getFlowState(library)).toBe('unloaded');
    await root.loadFlow(library);
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
    await storage.saveNamespaceMetadata('main', {autoLoadLibraries: ['service']});
    storage.saveLib('+main', 'service', {...libData, '#disabled': true});
    await root.start({main: {}});
    expect(root.getFlowState(ref('main', 'service', 'library'))).toBe('disabled');
    expect(Namespace.getFunctionLib('+main:service:value', root).getWorkerData('+main:service:value')).toBeNull();
  });

  it('persists auto-load selection for one namespace and applies changes immediately', async () => {
    storage.saveLib('+main', 'tools', libData);
    storage.saveLib('+shared', 'tools', libData);
    await root.start({main: {}, shared: {}});
    expect(root.getFlowState(ref('main', 'tools', 'library'))).toBe('unloaded');

    await root.setAutoLoadLibrary('main', 'tools', true);
    expect(await storage.getNamespaceMetadata('main')).toEqual({autoLoadLibraries: ['tools']});
    expect(await storage.getNamespaceMetadata('shared')).toEqual({});
    expect(root.getFlowState(ref('main', 'tools', 'library'))).toBe('enabled');
    expect(root.getFlowState(ref('shared', 'tools', 'library'))).toBe('unloaded');

    await root.setAutoLoadLibrary('main', 'tools', false);
    expect(root.getFlowState(ref('main', 'tools', 'library'))).toBe('enabled');
    await root.stop();
    await root.start({main: {}, shared: {}});
    expect(root.getFlowState(ref('main', 'tools', 'library'))).toBe('unloaded');
  });

  it('isolates caller disable from the library and other callers, including relative references', async () => {
    storage.saveLib('+main', 'tools', libData);
    for (const name of ['first', 'second']) {
      storage.saveFlow(
        null,
        {'#is': '', 'call': {'#is': '+main:tools:value'}, 'repeat': {'#is': 'worker', '#use': '+:tools:value'}},
        `+main.${name}`
      );
    }
    await root.start({main: {flows: ['*']}});
    await root.loadFlow(ref('main', 'tools', 'library'));
    root.runAll();
    expect(root.queryValue('+main.first.repeat.#worker.#+')).toBe(root.getValue('+main'));
    await root.disableFlow(ref('main', 'first'));
    root.runAll();
    expect(Namespace.getFunctionLib('+main:tools:value', root).getWorkerData('+main:tools:value')).toBeTruthy();
    expect(root.queryValue('+main.second.call.#output')).toBe(42);
    expect(root.queryValue('+main.second.repeat.#output')).toBe(42);
    await root.enableFlow(ref('main', 'first'));
    root.runAll();
    expect(root.queryValue('+main.first.repeat.#output')).toBe(42);
  });

  it('binds root and named namespace context to the owning runtime', async () => {
    storage.saveFlow(null, {'#is': '', 'child': {'#is': ''}}, 'entry');
    await root.start({'#root': {flows: ['entry']}, 'main': {}});
    expect(root.queryValue('entry.child.#+')).toBe(root);
    expect(root.queryValue('entry.child.#+main')).toBe(root.getValue('+main'));
  });

  it('tracks newly created libraries and preserves existing subscriptions', async () => {
    storage.saveFlow(null, {'#is': '', 'call': {'#is': '+main:tools:value'}}, '+main.entry');
    await root.start({main: {flows: ['entry']}});
    await shouldHappen(() => root.getFlowState(ref('main', 'tools', 'library')) === 'unloaded');
    root.addFlow('+main.:tools', libData);
    root.runAll();
    expect(root.getFlowState(ref('main', 'tools', 'library'))).toBe('enabled');
    expect(root.queryValue('+main.entry.call.#output')).toBe(42);
    await root.unloadFlow(ref('main', 'tools', 'library'));
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBeUndefined();
    await root.loadFlow(ref('main', 'tools', 'library'));
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBe(42);
  });

  it('cancels namespace activation while its metadata is still being read', async () => {
    await root.start();
    let resolve: (data: object) => void;
    vi.spyOn(storage, 'getNamespaceMetadata').mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const enabling = root.enableNamespace('main');
    await root.disableNamespace('main');
    resolve({autoLoadLibraries: ['service']});
    await expect(enabling).rejects.toThrow('cancelled');
    expect(Namespace.getNameSpace('+main', root)._enabled).toBe(false);
    expect(root.getFlowState(ref('main', 'service', 'library'))).toBe('unloaded');
    await root.enableNamespace('main');
    expect(Namespace.getNameSpace('+main', root)._enabled).toBe(true);
  });

  it('cancels pending loads on namespace disable even if the namespace is reenabled', async () => {
    await root.start({main: {}});
    let resolve: (data: object) => void;
    vi.spyOn(storage, 'loadFlow').mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      })
    );
    const loading = root.loadFlow(ref('main', 'entry'));
    await Promise.resolve();
    await root.disableNamespace('main');
    await root.enableNamespace('main');
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

  it('does not share namespace libraries between roots', async () => {
    storage.saveLib('+main', 'tools', libData);
    await root.start({main: {}});
    const other = new Root();
    await other.setStorage(storage);
    await other.start({shared: {}});
    await root.loadFlow(ref('main', 'tools', 'library'));
    expect(Namespace.getFunctionLib('+main:tools:value', other).getWorkerData('+main:tools:value')).toBeNull();
    await other.stop();
    other.destroy();
  });

  it('fails missing dependencies before loading flows and can start again', async () => {
    await storage.saveNamespaceMetadata('main', {dependencies: ['missing']});
    await expect(root.start({main: {}})).rejects.toThrow('Missing namespace');
    await root.start();
    expect(root._lifecycle.started).toBe(true);
  });

  it('rolls back failed service activation and retries without stopping other namespaces', async () => {
    await root.start({shared: {}});
    await storage.saveNamespaceMetadata('main', {autoLoadLibraries: ['service']});
    await expect(root.enableNamespace('main')).rejects.toThrow('Missing library');
    expect(Namespace.getNameSpace('+main', root)._enabled).toBe(false);
    expect(Namespace.getNameSpace('+shared', root)._enabled).toBe(true);
    storage.saveLib('+main', 'service', {...libData, startup: {'#is': 'add', 0: 10, 1: 20}});
    await root.enableNamespace('main');
    root.runAll();
    expect(root.queryValue('+main.:service.startup.#output')).toBe(30);
    expect(root.getFlowState(ref('main', 'service', 'library'))).toBe('enabled');
  });
});
