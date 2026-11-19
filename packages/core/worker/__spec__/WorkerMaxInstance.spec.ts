import {afterEach, describe, expect, it} from 'vitest';
import {Flow, Root, globalFunctions} from '../../index.ts';
import {Library} from '../../block/Library.ts';
import {
  DEFAULT_MAX_MULTI_WORKER_INSTANCES,
  DEFAULT_MAX_WORKER_INSTANCES,
  WorkerFunctionGen,
} from '../WorkerFunctionGen.ts';
import '../../functions/math/Arithmetic.ts';
import '../../functions/data/CreateObject.ts';

describe('worker #maxInstance limit', () => {
  const flows: Flow[] = [];
  const registered: string[] = [];

  afterEach(() => {
    for (const flow of flows.reverse()) flow.destroy();
    flows.length = 0;
    for (const id of registered.reverse()) Library.delete(id);
    registered.length = 0;
  });

  function register(name: string, data: Record<string, unknown>, lib = '+WorkerMaxInstance') {
    const id = `${lib}::${name}`;
    registered.push(id);
    WorkerFunctionGen.registerType(data, {name}, lib);
    return id;
  }

  it('caps direct recursive workers at #inputs.#maxInstance and frees slots on destroy', () => {
    const id = register('recurse', {
      '#is': '',
      '#inputs': {'#is': '', '#maxInstance': 4},
      'child': {'#is': '+WorkerMaxInstance::recurse'},
    });

    const flow = new Flow();
    flows.push(flow);
    const block = flow.createBlock('root');
    block.setValue('#is', id);
    Root.runAll(20);

    const dispatcher = Library.getFunctions(id, flow).listen(id, null);
    expect(dispatcher._listeners.size).toBe(4);

    // Traverse down the 4 created instances; the 4th child hits the cap and has no #worker.
    let current = block;
    for (let i = 0; i < 4; ++i) {
      const worker = current.getValue('#worker') as Flow;
      expect(worker).toBeInstanceOf(Flow);
      current = worker.getValue('child') as typeof block;
    }
    expect(current.getValue('#worker')).toBeUndefined();

    // Destroying the root worker frees all 4 slots.
    flow.deleteValue('root');
    Root.run();
    expect(dispatcher._listeners.size).toBe(0);

    // Non-recursive blocks can create up to #maxInstance siblings and reject the extra one.
    const cappedId = register('capped', {
      '#is': '',
      '#inputs': {'#is': '', '#maxInstance': 2, '#custom': [{name: 'n', type: 'number'}]},
      '#outputs': {'#is': '', '~#return': '##.#inputs.n'},
    });
    const b1 = flow.createBlock('b1');
    const b2 = flow.createBlock('b2');
    const b3 = flow.createBlock('b3');
    b1.setValue('#is', cappedId);
    b1.setValue('n', 1);
    b2.setValue('#is', cappedId);
    b2.setValue('n', 2);
    b3.setValue('#is', cappedId);
    b3.setValue('n', 3);
    Root.runAll();

    expect(b1.getValue('#return')).toBe(1);
    expect(b2.getValue('#return')).toBe(2);
    expect(b3.getValue('#worker')).toBeUndefined();

    // Re-running an existing instance at the exact cap works cleanly.
    b1.setValue('n', 10);
    Root.runAll();
    expect(b1.getValue('#return')).toBe(10);

    // Removing b2 frees 1 slot so rebinding b3 can instantiate on re-run.
    flow.deleteValue('b2');
    b3.setValue('#is', null);
    b3.setValue('#is', cappedId);
    Root.runAll();
    expect(b3.getValue('#return')).toBe(3);

    // StaticBlock internal listeners do not consume a worker instance slot.
    const staticModule = '+WorkerMaxInstanceStatic:mod';
    const staticId = `${staticModule}:withStatic`;
    registered.push(staticId);
    const modFlow = flow.createBlock('mod');
    WorkerFunctionGen.registerType(
      {
        '#is': '',
        '#inputs': {'#is': '', '#maxInstance': 1, '#custom': [{name: 'x', type: 'number'}]},
        '#static': {'#is': '', 'k': 7},
        '#outputs': {'#is': '', '~#return': '##.#inputs.x'},
      },
      {id: staticId, name: 'withStatic'},
      staticModule
    );
    const s1 = modFlow.createBlock('s1');
    s1.setValue('#is', staticId);
    s1.setValue('x', 5);
    Root.runAll();
    expect(s1.getValue('#return')).toBe(5);
  });

  it('tracks single and multi listeners separately and keeps WorkerFunction, MapFunction, and HandlerFunction null-safe', () => {
    const treeId = register('tree', {
      '#is': '',
      '#inputs': {'#is': '', '#maxInstance': 5, '#custom': [{name: 'depth', type: 'number'}]},
      'children': {
        '#is': 'multi-worker',
        'use': '+WorkerMaxInstance::tree',
        'input': [{depth: 1}, {depth: 2}],
      },
    });

    const flow = new Flow();
    flows.push(flow);
    const tree = flow.createBlock('tree');
    tree.setValue('#is', treeId);
    Root.runAll(20);

    const treeDispatcher = Library.getFunctions(treeId, flow).listen(treeId, null);
    expect(treeDispatcher._listeners.size).toBe(1);
    expect(treeDispatcher._multiListeners?.size).toBe(5);

    const leafId = register('leaf', {
      '#is': '',
      '#inputs': {'#is': '', '#maxInstance': 1, '#custom': [{name: 'v', type: 'number'}]},
      '#outputs': {'#is': '', '~#return': '##.#inputs.v'},
    });
    const leafDispatcher = Library.getFunctions(leafId, flow).listen(leafId, null);

    // Hold the single listener slot (w1 succeeds, w2 is rejected) and single multi slot (map succeeds, handler is rejected).
    const w1 = flow.createBlock('w1');
    w1.setValue('#is', 'worker');
    w1.setValue('#use', leafId);

    const w2 = flow.createBlock('w2');
    w2.setValue('#is', 'worker');
    w2.setValue('#use', leafId);

    const map = flow.createBlock('map');
    map.setValue('#is', 'map');
    map.setValue('use', leafId);
    map.setValue('input', [{v: 1}, {v: 2}]);

    const handler = flow.createBlock('handler');
    handler.setValue('#is', 'handler');
    handler.setValue('use', leafId);
    handler.setValue('#call', {v: 1});

    expect(() => Root.runAll()).not.toThrow();
    expect(leafDispatcher._listeners.size).toBe(1);
    expect(leafDispatcher._multiListeners?.size).toBe(1);
    expect(w1.getValue('#worker')).toBeInstanceOf(Flow);
    expect(w2.getValue('#worker')).toBeUndefined();
    expect(map.getValue('#output')).toEqual([1, 2]);
    expect(handler.queryValue('#workers.0')).toBeUndefined();
  });

  it('uses separate default caps for single (65536) and multi (8192) and never limits native JS functions', () => {
    expect(DEFAULT_MAX_WORKER_INSTANCES).toBe(65536);
    expect(DEFAULT_MAX_MULTI_WORKER_INSTANCES).toBe(8192);

    const id = register('invalidMax', {
      '#is': '',
      '#inputs': {'#is': '', '#maxInstance': 0},
    });
    const flow = new Flow();
    flows.push(flow);
    const factory = Library.getFunctions(id, flow).listen(id, null)?.getValue();
    expect(factory?.maxInstances).toBeUndefined();

    // Native JS functions have no ticlWorkerData and are never capped.
    expect(globalFunctions.getWorkerData('add')).toBeNull();
    for (let i = 0; i < 16; ++i) {
      const add = flow.createBlock(`add${i}`);
      add.setValue('#is', 'add');
      add.setValue('0', i);
      add.setValue('1', 1);
    }
    Root.run();
    expect(flow.queryValue('add15.#output')).toBe(16);
  });
});
