import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import '../../index.ts';
import {Flow, FlowNameSpace, Root} from '../Flow.ts';
import {MemoryFlowStorage} from '../MemoryFlowStorage.ts';
import {shouldHappen} from '../../util/test-util.ts';
import {makeLocalConnection} from '../../connect/LocalConnection.ts';

describe('namespace context', () => {
  let root: Root;
  let storage: MemoryFlowStorage;

  beforeEach(async () => {
    root = new Root();
    storage = new MemoryFlowStorage();
    await storage.saveNamespaceMetadata('main', {});
    await storage.saveNamespaceMetadata('shared', {});
    await root.setStorage(storage);
    root._globalRoot.setValue('^value', 1);
  });

  afterEach(async () => {
    await root.stop({discardChanges: true});
    root.destroy();
  });

  it('replaces the namespace mirror with one context property in the parent chain', async () => {
    storage.saveFlow(null, {'~value': '^value'}, '+main.folder.entry');
    await root.start({main: {flows: ['**']}, shared: {}});
    const ns = root.getValue('+main') as FlowNameSpace;
    const folder = root.queryValue('+main.folder') as Flow;
    const entry = root.queryValue('+main.folder.entry') as Flow;
    const context = ns._contextRoot;
    const value = context.getContextProperty('^value');

    expect(entry.getValue('value')).toBe(1);
    expect(entry.getContextProperty('^value')._bindingSource).toBe(folder.getContextProperty('^value'));
    expect(folder.getContextProperty('^value')._bindingSource).toBe(value);
    expect(ns.getContextProperty('^value')).toBe(value);
    expect(ns._props.has('^value')).toBe(false);
    expect(value._bindingSource).toBe(root._globalRoot.getProperty('^value'));

    context.setValue('^value', 2);
    expect(value._bindingSource).toBeNull();
    expect(entry.getValue('value')).toBe(2);
    expect(root.queryValue('+shared.^value')).toBe(1);
    entry.setValue('^value', 3);
    expect(entry.getValue('value')).toBe(3);
    context.setValue('^value', 4);
    expect(entry.getValue('value')).toBe(3);
    entry.deleteValue('^value');
    expect(entry.getValue('value')).toBe(4);
    context.deleteValue('^value');
    expect(entry.getValue('value')).toBe(1);
    root._globalRoot.setValue('^value', 5);
    expect(entry.getValue('value')).toBe(5);
  });

  it('isolates computation blocks from sibling flow names and keeps bindings reactive', async () => {
    storage.saveFlow(
      null,
      {
        '#is': '',
        'add': {'#is': 'add', '0': 2, '1': 3},
        '~^value': 'add.#output',
      },
      '+main.#context'
    );
    storage.saveFlow(null, {'value': 'ordinary flow', '~context': '^value'}, '+main.add');
    await root.start({main: {flows: ['**']}});
    root.runAll();
    expect(root.queryValue('+main.add.value')).toBe('ordinary flow');
    expect(root.queryValue('+main.add.context')).toBe(5);
    expect(root.queryValue('+main.#context.add.#output')).toBe(5);
    root.queryProperty('+main.#context.add.0').setValue(4);
    root.runAll();
    expect(root.queryValue('+main.add.context')).toBe(7);
    root.queryProperty('+main.#context.add.0').setValue(undefined);
    root.queryProperty('+main.#context.add.#is').setValue('');
    root.runAll();
    expect(root.queryValue('+main.add.context')).toBeUndefined();
    expect(await root.listFlows('main')).toEqual([{name: 'add', state: 'enabled'}]);
  });

  it('loads all namespace contexts before service libraries and ordinary flows', async () => {
    await storage.saveNamespaceMetadata('main', {dependencies: ['shared'], serviceLibraries: ['service']});
    storage.saveFlow(null, {'^value': 2}, '+main.#context');
    storage.saveFlow(null, {'^value': 3}, '+shared.#context');
    storage.saveLib('+main', 'service', {'~value': '^value'});
    storage.saveFlow(null, {'~value': '^value'}, '+main.entry');
    const read = vi.spyOn(storage, 'loadFlow');
    await root.start({main: {flows: ['entry']}});
    expect(read.mock.calls.map(([key]) => key)).toEqual([
      '+main.#context',
      '+shared.#context',
      '+main.:service',
      '+main.entry',
    ]);
    expect(root.queryValue('+main.:service.value')).toBe(2);
    expect(root.queryValue('+main.entry.value')).toBe(2);
  });

  it('keeps the caller context when invoking a worker from another namespace', async () => {
    await storage.saveNamespaceMetadata('main', {dependencies: ['shared']});
    storage.saveFlow(null, {'^value': 'caller'}, '+main.#context');
    storage.saveFlow(null, {'^value': 'definition'}, '+shared.#context');
    storage.saveLib('+shared', 'tools', {
      '#functions': {
        ':read': {type: 'worker', worker: {'#outputs': {'#is': '', '~#output': '^value'}}},
      },
    });
    storage.saveFlow(null, {call: {'#is': '+shared:tools:read'}}, '+main.entry');
    await root.start({main: {flows: ['entry']}});
    await root.loadFlow({namespace: 'shared', kind: 'library', name: 'tools'});
    root.runAll();
    expect(root.queryValue('+main.entry.call.#output')).toBe('caller');
  });

  it('persists only local definitions, rejects dirty shutdown, and reloads on activation', async () => {
    await root.start({main: {}});
    const context = root.queryValue('+main.#context') as Flow;
    context.getContextProperty('^value');
    context.startHistory();
    context.setValue('^local', false);
    context.trackChange();
    await expect(root.disableNamespace('main')).rejects.toThrow('unsaved changes');
    await expect(root.stop()).rejects.toThrow('unsaved changes');
    await context.applyChange();
    expect(await storage.loadFlow('+main.#context')).toEqual({'#is': '', '^local': false});
    await root.disableNamespace('main');
    expect(context.isDestroyed()).toBe(false);
    expect(context.getValue('^local')).toBeUndefined();
    storage.saveFlow(null, {'^local': null}, '+main.#context');
    await root.enableNamespace('main');
    expect(root.queryValue('+main.#context')).toBe(context);
    expect(root.queryValue('+main.^local')).toBeNull();
    expect(root.queryValue('+main.^value')).toBe(1);
  });

  it('cancels a pending context read without reviving disabled definitions', async () => {
    let resolve: (data: object) => void;
    const read = vi.spyOn(storage, 'loadFlow').mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const enabling = root.enableNamespace('main');
    await shouldHappen(() => read.mock.calls.length === 1);
    await root.disableNamespace('main');
    await root.enableNamespace('main');
    resolve({'^value': 'stale', 'add': {'#is': 'add', '0': 1, '1': 2}});
    await expect(enabling).rejects.toThrow('cancelled');
    root.runAll();
    expect(root.queryValue('+main.^value')).toBe(1);
    expect(root.queryValue('+main.#context.add')).toBeUndefined();
  });

  it('supports editor history and saves through the context flow boundary', async () => {
    await root.start({main: {}});
    const context = root.queryValue('+main.#context') as Flow;
    const [server, client] = makeLocalConnection(root, false);
    try {
      const listed = server.list({path: '+main', filter: null, max: 16}) as {
        children: Record<string, {canApply: boolean}>;
      };
      expect(listed.children['#context'].canApply).toBe(true);
      client.watch('+main.#context', {});
      await client.setValue('+main.#context.^value', 2, true);
      expect(context.getValue('@has-change')).toBe(true);
      await client.undo('+main.#context');
      expect(root.queryValue('+main.^value')).toBe(1);
      await client.redo('+main.#context');
      expect(root.queryValue('+main.^value')).toBe(2);
      await client.applyFlowChange('+main.#context');
      expect(await storage.loadFlow('+main.#context')).toEqual({'#is': '', '^value': 2});
      expect(context.getValue('@has-change')).toBeUndefined();
    } finally {
      client.destroy();
    }
  });

  it('stops context blocks and resets their definitions on stop/start', async () => {
    storage.saveFlow(null, {'add': {'#is': 'add', '0': 2, '1': 3}, '~^value': 'add.#output'}, '+main.#context');
    await root.start({main: {}});
    root.runAll();
    const add = root.queryValue('+main.#context.add') as Flow;
    expect(root.queryValue('+main.^value')).toBe(5);
    await root.stop();
    expect(add.isDestroyed()).toBe(true);
    expect(root.queryValue('+main.^value')).toBe(1);
    await root.start({main: {}});
    root.runAll();
    expect(root.queryValue('+main.^value')).toBe(5);
  });
});
