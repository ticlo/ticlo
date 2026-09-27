import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import '../../index.ts';
import {Root} from '../Flow.ts';
import {MemoryFlowStorage} from '../MemoryFlowStorage.ts';
import type {FlowRef} from '../FlowRuntime.ts';
import {Namespace} from '../Namespace.ts';
import {shouldHappen} from '../../util/test-util.ts';

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

  it.each([undefined, {}])('defaults to #root services without loading ordinary flows (%j)', async (options) => {
    await storage.saveNamespaceMetadata('#root', {serviceLibraries: ['service']});
    storage.saveLib('', 'service', libData);
    storage.saveFlow(null, {value: 1}, 'entry');
    const read = vi.spyOn(storage, 'loadFlow');
    await root.start(options);
    expect(root.getFlowState(ref('#root', 'entry'))).toBe('unloaded');
    expect(root.getFlowState(ref('#root', 'service', 'library'))).toBe('enabled');
    expect(read).not.toHaveBeenCalledWith('entry');
    expect(root.getValue('+#root')).toBeUndefined();
  });

  it('cancels startup while storage is discovering default projects', async () => {
    let resolve: (options: Record<string, {flows?: string[]}>) => void;
    Object.assign(storage, {
      getDefaultStartOptions: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    const starting = root.start();
    await root.stop();
    resolve({main: {flows: ['**']}});
    await expect(starting).rejects.toThrow('cancelled');
    expect(root.getValue('+main')).toBeUndefined();
    expect(root._lifecycle.started).toBe(false);
  });

  it('uses policy globs per namespace and enables cyclic dependencies without ordinary dependency flows', async () => {
    await storage.saveNamespaceMetadata('main', {dependencies: ['shared']});
    await storage.saveNamespaceMetadata('shared', {dependencies: ['main'], serviceLibraries: ['service']});
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

  it('keeps inactive libraries empty, lazily loads on activation, and rebinds after disable and unload', async () => {
    storage.saveLib('+shared', 'tools', libData);
    storage.saveFlow(
      null,
      {'#is': '', 'call': {'#is': '+shared:tools:value'}, 'repeat': {'#is': 'worker', '+use': '+shared:tools:value'}},
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
    await storage.saveNamespaceMetadata('main', {serviceLibraries: ['service']});
    storage.saveLib('+main', 'service', {...libData, '#disabled': true});
    await root.start({main: {}});
    expect(root.getFlowState(ref('main', 'service', 'library'))).toBe('disabled');
    expect(Namespace.getFunctionLib('+main:service:value', root).getWorkerData('+main:service:value')).toBeNull();
  });

  it('isolates caller disable from the library and other callers, including relative references', async () => {
    storage.saveLib('+main', 'tools', libData);
    for (const name of ['first', 'second']) {
      storage.saveFlow(
        null,
        {'#is': '', 'call': {'#is': '+main:tools:value'}, 'repeat': {'#is': 'worker', '+use': '+:tools:value'}},
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
    resolve({serviceLibraries: ['service']});
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
    await storage.saveNamespaceMetadata('main', {serviceLibraries: ['service']});
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
