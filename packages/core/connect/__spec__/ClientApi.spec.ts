import {expect} from 'vitest';
import {Block} from '../../block/Block.ts';
import {Flow, Root} from '../../block/Flow.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import '../../functions/math/Arithmetic.ts';
import '../../functions/Categories.ts';
import {AsyncClientPromise} from './AsyncClientPromise.ts';
import {VoidListeners, TestFunctionRunner} from '../../block/__spec__/TestFunction.ts';
import {FunctionDesc} from '../../block/Descriptor.ts';
import {shouldHappen, shouldReject} from '../../util/test-util.ts';
import {JsFunction} from '../../functions/script/Js.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import {DataMap, isDataTruncated} from '../../util/DataTypes.ts';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.ts';
import {FlowEditor} from '../../worker/FlowEditor.ts';
import {WorkerFlow} from '../../worker/WorkerFlow.ts';
import {MemoryFlowStorage} from '../../block/MemoryFlowStorage.ts';
import type {CompletedRequest} from '../ClientConnection.ts';

// @ts-ignore
const beforeAll = globalThis.beforeAll ?? globalThis.before;
// @ts-ignore
const afterAll = globalThis.afterAll ?? globalThis.after;

describe('Connection Client API', function () {
  it('waits for a new flow file to be saved before completing the request', async () => {
    const root = new Root();
    const storage = new MemoryFlowStorage();
    const getFlowLoader = storage.getFlowLoader.bind(storage);
    let releaseSave: () => void;
    const saveGate = new Promise<void>((resolve) => (releaseSave = resolve));
    let saving = false;
    storage.getFlowLoader = (key) => {
      const loader = getFlowLoader(key);
      if (key !== 'created') return loader;
      return {
        ...loader,
        applyChange: async (flow) => {
          saving = true;
          await saveGate;
          return loader.applyChange(flow);
        },
      };
    };
    await root.setStorage(storage);
    await root.start({'#root': {}});
    const [, client] = makeLocalConnection(root, false);
    try {
      const request = client.addFlow('created', {value: 1}) as Promise<unknown>;
      await shouldHappen(() => saving);
      expect(storage.flows.has('created')).toBe(false);
      releaseSave();
      await request;
      expect(storage.flows.has('created')).toBe(true);
    } finally {
      releaseSave();
      client.destroy();
      await root.stop({discardChanges: true});
      root.destroy();
    }
  });

  it('removes a new flow from memory when its first save fails', async () => {
    const root = new Root();
    const storage = new MemoryFlowStorage();
    const getFlowLoader = storage.getFlowLoader.bind(storage);
    storage.getFlowLoader = (key) =>
      key === 'created'
        ? {
            applyChange: async () => {
              throw new Error('Save failed');
            },
          }
        : getFlowLoader(key);
    await root.setStorage(storage);
    await root.start({'#root': {}});
    const [, client] = makeLocalConnection(root, false);
    try {
      await expect(client.addFlow('created', {value: 1}) as Promise<unknown>).rejects.toContain('Save failed');
      expect(root.queryProperty('created')?._value).toBeUndefined();
    } finally {
      client.destroy();
      await root.stop({discardChanges: true});
      root.destroy();
    }
  });

  it('loads and toggles stored flows through lifecycle commands with server policy checks', async () => {
    const root = new Root();
    const storage = new MemoryFlowStorage();
    storage.saveFlow(null, {value: 1}, 'entry');
    await root.setStorage(storage);
    await root.start({'#root': {}});
    const [server, client] = makeLocalConnection(root, false);
    const completed: CompletedRequest[] = [];
    client.completedRequests().listen((request) => completed.push(request));
    try {
      expect(await client.getFlowState('entry')).toMatchObject({state: 'unloaded'});
      await client.loadFlow('entry');
      expect(completed.at(-1)).toMatchObject({cmd: 'loadFlow', path: 'entry'});
      expect(await client.listLoadedFlows('#root')).toMatchObject({
        flows: [{library: '#root', kind: 'flow', name: 'entry'}],
      });
      expect(await client.getFlowState('entry')).toMatchObject({state: 'enabled'});
      await client.disableFlow('entry', {persist: true});
      expect(await client.getFlowState('entry')).toMatchObject({state: 'disabled'});
      await client.unloadFlow('entry');
      await client.loadFlow('entry');
      expect(await client.getFlowState('entry')).toMatchObject({state: 'disabled'});
      server.setEditPolicy({readonly: true});
      const completedBeforeError = completed.length;
      await expect(client.enableFlow('entry')).rejects.toBe('readonly');
      expect(completed).toHaveLength(completedBeforeError);
      expect(await client.getFlowState('entry')).toMatchObject({state: 'disabled'});
      server.setEditPolicy({});
      await client.enableFlow('entry');
      expect(await client.getFlowState('entry')).toMatchObject({state: 'enabled'});
      server.setEditPolicy({denyPaths: ['entry', 'entry.**']});
      await expect(client.disableFlow('+#root.entry')).rejects.toContain('unqualified');
      server.setEditPolicy({readonly: true, denyPaths: ['entry', 'entry.**']});
      expect(await client.listLoadedFlows('#root')).toMatchObject({flows: []});
      await expect(client.getFlowState('entry')).rejects.toBe('restricted path');
      expect(root.getFlowState({library: '#root', kind: 'flow', name: 'entry'})).toBe('enabled');
    } finally {
      client.destroy();
      await root.stop({discardChanges: true});
      root.destroy();
    }
  });
  beforeAll(function () {
    globalFunctions.addFactory(
      null,
      {
        name: 'func1',
        properties: [],
        optional: {p1: {name: 'p1', type: 'string'}},
      },
      'ClientConnection'
    );
    globalFunctions.addFactory(
      null,
      {
        base: 'ClientConnection:func1',
        name: 'func2',
        properties: [],
        optional: {p2: {name: 'p2', type: 'string'}},
      },
      'ClientConnection'
    );
    globalFunctions.addFactory(
      null,
      {
        base: 'ClientConnection:func2',
        name: 'func3',
        properties: [],
        optional: {p3: {name: 'p3', type: 'string'}},
      },
      'ClientConnection'
    );
    globalFunctions.addFactory(
      null,
      {
        base: 'ClientConnection:func1',
        name: 'func4',
        properties: [],
        optional: {p4: {name: 'p4', type: 'string'}},
      },
      'ClientConnection'
    );
    globalFunctions.addFactory(
      null,
      {
        base: 'ClientConnection:func2',
        name: 'func5',
        properties: [],
        optional: {p5: {name: 'p5', type: 'string'}},
      },
      'ClientConnection'
    );
  });

  afterAll(function () {
    globalFunctions.delete('ClientConnection:func1');
    globalFunctions.delete('ClientConnection:func2');
    globalFunctions.delete('ClientConnection:func3');
    globalFunctions.delete('ClientConnection:func4');
    globalFunctions.delete('ClientConnection:func5');
  });

  it('getCommonfuncFunc', async function () {
    const [server, client] = makeLocalConnection(Root.instance, true);
    await client.getValue('doesnt_matter__just_wait_for_init');

    const func1 = client.watchDesc('ClientConnection:func1');
    const func2 = client.watchDesc('ClientConnection:func2');
    const func3 = client.watchDesc('ClientConnection:func3');
    const func4 = client.watchDesc('ClientConnection:func4');
    const func5 = client.watchDesc('ClientConnection:func5');

    expect(client.getCommonBaseFunc(new Set([func5]))).toBe(func5);
    expect(client.getCommonBaseFunc(new Set([func3, func5]))).toBe(func2);
    expect(client.getCommonBaseFunc(new Set([func2, func3, func5]))).toBe(func2);
    expect(client.getCommonBaseFunc(new Set([func2, func4]))).toBe(func1);
    expect(client.getCommonBaseFunc(new Set([func3, func5, func4]))).toBe(func1);
    client.destroy();
  });

  it('getOptionalProps', async function () {
    const [server, client] = makeLocalConnection(Root.instance, true);
    await client.getValue('doesnt_matter__just_wait_for_init');

    const func1 = client.watchDesc('ClientConnection:func1');
    const func5 = client.watchDesc('ClientConnection:func5');

    expect(Object.keys(client.getOptionalProps(func1))).toEqual(['p1']);
    expect(Object.keys(client.getOptionalProps(func5))).toEqual(['p1', 'p2', 'p5']);

    client.destroy();
  });
});
