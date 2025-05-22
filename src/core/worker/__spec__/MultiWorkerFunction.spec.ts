import {expect} from 'vitest';
import {Flow, Root} from '../../block/Flow';
import {TestFunctionRunner} from '@ticlo/core/block/__spec__/TestFunction';
import '../../functions/math/Arithmetic';
import '../MultiWorkerFunction';
import {DataMap} from '../../util/DataTypes';

describe('MultiWorkerFunction', function () {
  it('chain block', function () {
    TestFunctionRunner.clearLog();
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    let bBlock = flow.createBlock('b');
    let cBlock = flow.createBlock('c');
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
    let obj4 = aBlock.createBlock('obj4');
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
    let flow = new Flow();

    let bBlock = flow.createBlock('b');

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

    flow.updateValue('a', {obj3: {v: 3}, obj2: {v: 2}});
    Root.run();
    expect(bBlock.getValue('#output')).toEqual({obj2: {v: 3}, obj3: {v: 4}});

    bBlock.setValue('#is', '');
    expect(bBlock.getValue('#output')).not.toBeDefined();
    expect(bBlock.getValue('#flow')).not.toBeDefined();
  });

  it('multi-worker primitive types', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    let bBlock = flow.createBlock('b');
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
          '#outputs': {'#is': '', '~#value': '##.add.#output'},
        },
      },
    });

    Root.run();
    expect(bBlock.getValue('#output')).toEqual({v1: 2, v2: 3});

    aBlock.setValue('v3', 3);
    aBlock.deleteValue('v1');

    Root.run();

    expect(bBlock.getValue('#output')).toEqual({v2: 3, v3: 4});

    flow.setValue('a', 1);

    Root.run();
    expect(bBlock.getValue('#output')).not.toBeDefined();
  });

  it('clear multi-worker use', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    let bBlock = flow.createBlock('b');
    aBlock._load({v1: 1});
    bBlock._load({
      '#is': 'multi-worker',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          '#inputs': {'#is': ''},
          '#outputs': {'#is': '', '~#value': '##.#inputs.#value'},
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
