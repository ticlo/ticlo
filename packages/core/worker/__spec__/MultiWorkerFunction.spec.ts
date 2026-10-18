import {expect} from 'vitest';
import {Flow, Root} from '../../block/Flow.ts';
import type {Block} from '../../block/Block.ts';
import {TestFunctionRunner} from '../../block/__spec__/TestFunction.ts';
import '../../functions/math/Arithmetic.ts';
import '../MultiWorkerFunction.ts';
import {DataMap} from '../../util/DataTypes.ts';

function createArrayWorker(input: unknown[], key = 'id') {
  const flow = new Flow();
  const block = flow.createBlock('multi');
  block._load({
    '#is': 'multi-worker',
    input,
    key,
    'use': {
      '#is': {
        '#is': '',
        '#inputs': {'#is': '', '#custom': [{name: 'v', type: 'number'}]},
        '#outputs': {'#is': '', '~#return': '##.#inputs.v'},
      },
    },
  });
  Root.run();
  return {flow, block};
}

describe('MultiWorkerFunction', function () {
  it('chain block', function () {
    TestFunctionRunner.clearLog();
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    const bBlock = flow.createBlock('b');
    const cBlock = flow.createBlock('c');
    aBlock._load({
      '#is': '',
      'obj1': {'#is': '', 'v': 1},
      'obj2': {'#is': '', 'v': 2},
      'obj3': {v: 3},
    });
    bBlock._load({
      '#is': 'multi-worker',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'test': {'#is': 'test-runner', '~#-log': '##.#inputs.v'},
          'add': {'#is': 'add', '~0': '##.#inputs.v', '1': 1},
          '#inputs': {'#is': '', '#custom': [{name: 'v', type: 'number'}]},
          '#outputs': {'#is': '', '~v': '##.add.#output'},
        },
      },
    });
    cBlock._load({
      '#is': 'multi-worker',
      '~input': '##.b.#output',
      'use': {
        '#is': {
          '#is': '',
          'multiply': {'#is': 'multiply', '~0': '##.#inputs.v', '1': 2},
          '#inputs': {'#is': '', '#custom': [{name: 'v', type: 'number'}]},
          '#outputs': {'#is': '', '~v': '##.multiply.#output'},
        },
      },
    });
    Root.runAll(2);

    expect(TestFunctionRunner.popLogs().length).toBe(3);
    expect(bBlock.getValue('#output')).toEqual({obj1: {v: 2}, obj2: {v: 3}, obj3: {v: 4}});
    expect(cBlock.getValue('#output')).toEqual({obj1: {v: 4}, obj2: {v: 6}, obj3: {v: 8}});

    bBlock.updateValue('use', {
      '#is': '',
      'test': {'#is': 'test-runner', '~#-log': '##.#inputs.v'},
      'subtract': {'#is': 'subtract', '~0': '##.#inputs.v', '1': 5},
      '#inputs': {'#is': '', '#custom': [{name: 'v', type: 'number'}]},
      '#outputs': {'#is': '', '~v': '##.subtract.#output'},
    });
    Root.runAll(2);
    expect(TestFunctionRunner.popLogs().length).toBe(3);

    expect(cBlock.getValue('#output')).toEqual({obj1: {v: -8}, obj2: {v: -6}, obj3: {v: -4}});

    aBlock.deleteValue('obj2');
    const obj4 = aBlock.createBlock('obj4');
    obj4.setValue('v', 4);
    aBlock.updateValue('obj5', {v: 5});

    Root.runAll(2);
    expect(TestFunctionRunner.popLogs().length).toBe(2);

    expect(cBlock.getValue('#output')).toEqual({
      obj1: {
        v: -8,
      },
      obj3: {
        v: -4,
      },
      obj4: {
        v: -2,
      },
      obj5: {
        v: 0,
      },
    });

    flow.updateValue('b', null);
    aBlock.updateValue('obj6', {v: 6});

    Root.run();

    expect(cBlock.getValue('#output')).not.toBeDefined();

    expect(TestFunctionRunner.logs).toEqual([]);
  });

  it('watch object', function () {
    const flow = new Flow();

    const bBlock = flow.createBlock('b');

    flow.updateValue('a', {obj1: {v: 1}, obj2: {v: 2}});
    bBlock._load({
      '#is': 'multi-worker',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'add': {'#is': 'add', '~0': '##.#inputs.v', '1': 1},
          '#inputs': {'#is': '', '#custom': [{name: 'v', type: 'number'}]},
          '#outputs': {'#is': '', '~v': '##.add.#output'},
        },
      },
    });

    Root.run();
    expect(bBlock.getValue('#output')).toEqual({obj1: {v: 2}, obj2: {v: 3}});
    const removedWorker = bBlock.queryValue('#workers.obj1') as Block;
    const reusedWorker = bBlock.queryValue('#workers.obj2') as Block;
    const reusedChild = reusedWorker.getValue('add');
    reusedWorker.setValue('localState', 'preserved');

    flow.updateValue('a', {obj3: {v: 3}, obj2: {v: 2}});
    Root.run();
    expect(bBlock.getValue('#output')).toEqual({obj2: {v: 3}, obj3: {v: 4}});
    expect(removedWorker.isDestroyed()).toBe(true);
    expect(bBlock.queryValue('#workers.obj2')).toBe(reusedWorker);
    expect(reusedWorker.getValue('add')).toBe(reusedChild);
    expect(reusedWorker.getValue('localState')).toBe('preserved');

    flow.updateValue('a', {obj2: {v: 5}});
    Root.run();
    expect(bBlock.getValue('#output')).toEqual({obj2: {v: 6}});
    expect(bBlock.queryValue('#workers.obj2')).toBe(reusedWorker);

    bBlock.updateValue('use', {
      '#is': '',
      '#outputs': {'#is': '', 'v': 10},
    });
    Root.run();
    expect(bBlock.getValue('#output')).toEqual({obj2: {v: 10}});
    expect(reusedWorker.isDestroyed()).toBe(true);
    expect(bBlock.queryValue('#workers.obj2')).not.toBe(reusedWorker);

    bBlock.setValue('#is', '');
    expect(bBlock.getValue('#output')).not.toBeDefined();
    expect(bBlock.getValue('#worker')).not.toBeDefined();
    flow.destroy();
  });

  it('reuses array workers by index and updates output shape', function () {
    const flow = new Flow();
    const block = flow.createBlock('multi');
    block._load({
      '#is': 'multi-worker',
      'input': [1, 2, 3],
      'use': {
        '#is': {
          '#is': '',
          '#inputs': {'#is': ''},
          '#outputs': {'#is': '', '~#return': '##.#inputs.#value'},
        },
      },
    });
    Root.run();
    expect(block.getValue('#output')).toEqual([1, 2, 3]);
    const firstWorker = block.queryValue('#workers.0') as Block;
    const secondWorker = block.queryValue('#workers.1') as Block;
    const removedWorker = block.queryValue('#workers.2') as Block;

    block.setValue('input', [4, 2]);
    Root.run();
    expect(block.getValue('#output')).toEqual([4, 2]);
    expect(block.queryValue('#workers.0')).toBe(firstWorker);
    expect(block.queryValue('#workers.1')).toBe(secondWorker);
    expect(removedWorker.isDestroyed()).toBe(true);

    block.setValue('input', [4, 2, 5]);
    Root.run();
    expect(block.getValue('#output')).toEqual([4, 2, 5]);
    expect(block.queryValue('#workers.0')).toBe(firstWorker);
    expect(block.queryValue('#workers.2')).not.toBe(removedWorker);

    block.setValue('input', {'0': 4});
    Root.run();
    expect(block.getValue('#output')).toEqual({'0': 4});
    expect(block.queryValue('#workers.0')).toBe(firstWorker);
    expect(secondWorker.isDestroyed()).toBe(true);

    block.setValue('input', [4]);
    Root.run();
    expect(block.getValue('#output')).toEqual([4]);
    expect(block.queryValue('#workers.0')).toBe(firstWorker);

    block.setValue('input', {'0': 4, 'length': 1});
    Root.run();
    expect(block.getValue('#output')).toEqual({'0': 4, 'length': 1});

    block.setValue('input', []);
    Root.run();
    expect(block.getValue('#output')).toEqual([]);
    expect(firstWorker.isDestroyed()).toBe(true);

    block.setValue('input', [undefined]);
    Root.run();
    expect(block.getValue('#output')).toEqual([undefined]);
    expect(block.queryValue('#workers.0')).not.toBeDefined();

    block.setValue('input', {});
    Root.run();
    expect(block.getValue('#output')).toEqual({});
    flow.destroy();
  });

  it('cleans up watches when switching between Block and object inputs', function () {
    const flow = new Flow();
    const input = flow.createBlock('input');
    input.setValue('v', 1);
    const block = flow.createBlock('multi');
    block._load({
      '#is': 'multi-worker',
      '~input': '##.input',
      'use': {
        '#is': {
          '#is': '',
          '#inputs': {'#is': ''},
          '#outputs': {'#is': '', '~#return': '##.#inputs.#value'},
        },
      },
    });
    Root.run();
    expect(block.getValue('#output')).toEqual({v: 1});
    const oldWorker = block.queryValue('#workers.v') as Block;

    input.setValue('v', 2);
    block.setValue('input', {v: 3});
    Root.run();
    expect(block.getValue('#output')).toEqual({v: 3});
    expect(oldWorker.isDestroyed()).toBe(true);

    input.setValue('v', 4);
    Root.run();
    expect(block.getValue('#output')).toEqual({v: 3});

    block.setBinding('input', '##.input');
    Root.run();
    expect(block.getValue('#output')).toEqual({v: 4});
    input.setValue('v', 5);
    Root.run();
    expect(block.getValue('#output')).toEqual({v: 5});
    flow.destroy();
  });

  it('reuses array workers by an item property and keeps input order', function () {
    const a = {id: 'a', v: 1};
    const b = {id: 'b', v: 2};
    const {flow, block} = createArrayWorker([a, b]);
    expect(block.getValue('#output')).toEqual([1, 2]);
    const workerA = block.queryValue('#workers.a') as Block;
    const workerB = block.queryValue('#workers.b') as Block;
    workerB.setValue('localState', 'preserved');

    block.setValue('input', [b, a]);
    Root.run();
    expect(block.getValue('#output')).toEqual([2, 1]);
    expect(block.queryValue('#workers.a')).toBe(workerA);
    expect(block.queryValue('#workers.b')).toBe(workerB);

    (workerA.getValue('#inputs') as Block).setValue('v', 7);
    Root.run();
    expect(block.getValue('#output')).toEqual([2, 7]);

    block.setValue('input', [
      {id: 'b', v: 3},
      {id: 'c', v: 4},
    ]);
    Root.run();
    expect(block.getValue('#output')).toEqual([3, 4]);
    expect(block.queryValue('#workers.b')).toBe(workerB);
    expect(workerB.getValue('localState')).toBe('preserved');
    expect(workerA.isDestroyed()).toBe(true);
    expect(block.queryValue('#workers.c')).toBeDefined();

    block.setValue('input', {b: {v: 5}});
    Root.run();
    expect(block.getValue('#output')).toEqual({b: 5});
    expect(block.queryValue('#workers.b')).toBe(workerB);
    flow.destroy();
  });

  it('skips missing and duplicate array keys', function () {
    const {flow, block} = createArrayWorker([
      {id: 10, v: 1},
      {id: 2, v: 2},
      {v: 100},
      {id: null, v: 100},
      {id: {}, v: 100},
      null,
      undefined,
      {id: 0, v: 3},
      {id: '2', v: 4},
      {id: '__proto__', v: 5},
      {id: 'length', v: 6},
    ]);
    const output = block.getValue('#output') as number[];
    expect(output).toHaveLength(5);
    expect(output[0]).toBe(1);
    expect([2, 4]).toContain(output[1]);
    expect(output.slice(2)).toEqual([3, 5, 6]);
    const workers = block.getValue('#workers') as Block;
    expect(workers.getValue('0')).toBeDefined();
    expect(workers.getValue('__proto__')).toBeDefined();

    block.setValue('input', [{v: 100}]);
    Root.run();
    expect(block.getValue('#output')).toEqual([]);
    expect(workers.getValue('10')).not.toBeDefined();
    flow.destroy();
  });

  it('updates workers when selecting or clearing the key property', function () {
    const {flow, block} = createArrayWorker(
      [
        {id: 'a', otherId: 'x', v: 1},
        {id: 'b', otherId: 'y', v: 2},
      ],
      ''
    );
    const indexWorker = block.queryValue('#workers.0') as Block;
    block.setValue('key', 'id');
    Root.run();
    expect(block.getValue('#output')).toEqual([1, 2]);
    expect(indexWorker.isDestroyed()).toBe(true);
    const idWorker = block.queryValue('#workers.a') as Block;

    block.setValue('key', 'otherId');
    Root.run();
    expect(block.getValue('#output')).toEqual([1, 2]);
    expect(idWorker.isDestroyed()).toBe(true);
    expect(block.queryValue('#workers.x')).toBeDefined();

    block.deleteValue('key');
    Root.run();
    expect(block.getValue('#output')).toEqual([1, 2]);
    expect(block.queryValue('#workers.0')).toBeDefined();
    expect(block.queryValue('#workers.x')).not.toBeDefined();
    flow.destroy();
  });

  it('multi-worker primitive types', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    const bBlock = flow.createBlock('b');
    aBlock._load({
      '#is': '',
      'v1': 1,
      'v2': '2',
    });
    bBlock._load({
      '#is': 'multi-worker',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'add': {'#is': 'add', '~0': '##.#inputs.#value', '1': 1},
          '#inputs': {'#is': ''},
          '#outputs': {'#is': '', '~#return': '##.add.#output'},
        },
      },
    });

    Root.run();
    expect(bBlock.getValue('#output')).toEqual({v1: 2, v2: 3});

    aBlock.setValue('v3', 3);
    aBlock.deleteValue('v1');

    Root.run();

    expect(bBlock.getValue('#output')).toEqual({v2: 3, v3: 4});

    aBlock.setValue('v1', 4);
    Root.run();

    expect(bBlock.getValue('#output')).toEqual({v1: 5, v2: 3, v3: 4});

    flow.setValue('a', 1);

    Root.run();
    expect(bBlock.getValue('#output')).not.toBeDefined();
  });

  it('clear multi-worker use', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    const bBlock = flow.createBlock('b');
    aBlock._load({v1: 1});
    bBlock._load({
      '#is': 'multi-worker',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          '#inputs': {'#is': ''},
          '#outputs': {'#is': '', '~#return': '##.#inputs.#value'},
        },
      },
    });

    Root.run();
    expect(bBlock.getValue('#output')).toEqual({v1: 1});

    bBlock.setValue('use', null);
    Root.run();
    expect(bBlock.getValue('#output')).not.toBeDefined();
  });
});
