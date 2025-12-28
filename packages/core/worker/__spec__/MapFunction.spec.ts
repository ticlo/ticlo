import {expect} from 'vitest';
import {Flow, Root} from '../../block/Flow.js';
import {TestFunctionRunner, TestAsyncFunctionPromise} from '../../block/__spec__/TestFunction.js';
import '../../functions/math/Arithmetic.js';
import '../MapFunction.js';
import {DataMap} from '../../util/DataTypes.js';
import {ErrorEvent} from '../../block/Event.js';
import {shouldTimeout} from '../../util/test-util.js';

describe('MapFunction non-thread', function () {
  beforeEach(() => {
    TestFunctionRunner.clearLog();
  });

  afterEach(() => {
    TestFunctionRunner.clearLog();
  });

  it('basic', function () {
    const flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#inputs', '1': 1},
          '#outputs': {'#is': '', '~#return': '##.add.#output'},
        },
      },
    });

    Root.runAll(2);

    expect(bBlock.getValue('#output')).toEqual({v1: 2, v2: 3, v3: 4});

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.runAll(2);

    expect(bBlock.getValue('#output')).toEqual({v1: 2, v2: 5, v4: 6});

    expect(TestFunctionRunner.popLogs().length).toBe(6);

    // delete flow;
    flow.deleteValue('b');
  });

  it('empty input', function () {
    const flow = new Flow();

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'input': {},
      'use': {
        '#is': {
          '#is': '',
        },
      },
    });

    Root.run();
    expect(bBlock.getValue('#output')).toEqual({});

    flow.deleteValue('b');
  });

  it('#inputs', function () {
    const flow = new Flow();

    flow.setValue('a', {
      v1: {a: 1, b: 2},
      v2: {a: 3, b: 4},
    });

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          '#outputs': {'#is': '', '~#return': '##.#inputs.a'},
        },
      },
    });
    Root.runAll(2);
    expect(bBlock.getValue('#output')).toEqual({v1: 1, v2: 3});

    bBlock.setValue('use', {
      '#is': '',
      '#inputs': {'#is': ''},
      '#outputs': {'#is': '', '~#return': '##.#inputs.#value.b'},
    });

    Root.runAll(2);
    expect(bBlock.getValue('#output')).toEqual({v1: 2, v2: 4});

    bBlock.setValue('use', {
      '#is': '',
      '#inputs': {'#is': '', '#custom': [{name: 'a', type: 'number'}]},
      '#outputs': {'#is': '', '~#return': '##.#inputs.a'},
    });

    Root.runAll(2);
    expect(bBlock.getValue('#output')).toEqual({v1: 1, v2: 3});

    // delete flow;
    flow.deleteValue('b');
  });

  it('input object', function () {
    const flow = new Flow();

    const data = {
      v1: {v: 1},
      v2: {v: 2},
      v3: {v: 3},
    };

    flow.setValue('a', data);

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          '#outputs': {'#is': '', '~v': '##.#inputs.v'},
        },
      },
    });

    Root.runAll(2);

    expect(bBlock.getValue('#output')).toEqual(data);

    // delete flow;
    flow.deleteValue('b');
  });

  it('change use', function () {
    const flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'reuse',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#inputs', '1': 1},
          '#outputs': {'#is': '', '~#return': '##.add.#output'},
        },
      },
    });

    Root.runAll(2);

    expect(bBlock.getValue('#output')).toEqual({v1: 2, v2: 3, v3: 4});

    bBlock.setValue('use', {
      '#is': '',
      'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
      'add': {'#is': 'add', '~0': '##.#inputs', '1': 2},
      '#outputs': {'#is': '', '~#return': '##.add.#output'},
    });

    Root.runAll(2);

    expect(bBlock.getValue('#output')).toEqual({v1: 3, v2: 4, v3: 5});

    expect(TestFunctionRunner.popLogs().length).toBe(6);

    // delete flow;
    flow.deleteValue('b');
  });

  it('reuse worker', function () {
    const flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'reuse',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#inputs', '1': 1},
          '#outputs': {'#is': '', '~#return': '##.add.#output'},
        },
      },
    });

    Root.run();

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.run();

    expect(bBlock.getValue('#output')).toEqual({v1: 2, v2: 3, v3: 4});

    Root.run();

    expect(bBlock.getValue('#output')).toEqual({v1: 2, v2: 5, v4: 6});
    expect(bBlock.queryValue('#flows.v3.#outputs')).not.toBeDefined();

    expect(TestFunctionRunner.popLogs().length).toBe(4);

    // delete flow;
    flow.deleteValue('b');
  });

  it('persist worker', function () {
    const flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'persist',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#inputs', '1': 1},
          '#outputs': {'#is': '', '~#return': '##.add.#output'},
        },
      },
    });

    Root.runAll(2);

    expect(bBlock.getValue('#output')).toEqual({v1: 2, v2: 3, v3: 4});

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.runAll(2);

    expect(bBlock.getValue('#output')).toEqual({v1: 2, v2: 5, v4: 6});
    expect(bBlock.queryValue('#flows.v3.#outputs.#return')).toBe(4);

    expect(TestFunctionRunner.popLogs().length).toBe(4);

    // delete flow;
    flow.deleteValue('b');
  });

  it('conversion from Block', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    const bBlock = flow.createBlock('b');

    aBlock._load({
      '#is': '',
      'obj1': {'#is': '', 'v': 1},
      'obj2': {'#is': '', 'v': 2},
      'obj3': {v: 3},
    });

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'reuse',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'add': {'#is': 'add', '~0': '##.#inputs.v', '1': 1},
          '#outputs': {'#is': '', '~v': '##.add.#output'},
        },
      },
    });

    Root.runAll(2);

    expect(bBlock.getValue('#output')).toEqual({
      obj1: {v: 2},
      obj2: {v: 3},
      obj3: {v: 4},
    });

    // delete flow;
    flow.deleteValue('b');
  });

  it('async worker', async function () {
    const flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'async': {'#is': 'async-function-promise', '~#call': '##.#inputs'},
          'add': {
            '#is': 'add',
            '#mode': 'onCall',
            '~#call': '##.async.#emit',
            '~0': '##.#inputs',
            '1': 1,
          },
          '#outputs': {
            '#is': '',
            '~#return': '##.add.#output',
            '~#wait': '##.async.#wait',
          },
        },
      },
    });

    Root.run();

    expect(bBlock.getValue('#output')).not.toBeDefined();

    expect(await bBlock.waitNextValue('#output')).toEqual({v1: 2, v2: 3, v3: 4});

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.run();

    expect(await bBlock.waitNextValue('#output')).toEqual({
      v1: 2,
      v2: 5,
      v4: 6,
    });

    expect(TestFunctionRunner.popLogs().length).toBe(6);

    // delete flow;
    flow.deleteValue('b');
  });

  it('timeout', async function () {
    const flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
    });

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          '#wait': true,
        },
      },
    });

    // without timeout, block would never have output
    await shouldTimeout(bBlock.waitNextValue('#output'), 10);

    bBlock.setValue('timeout', 0.01);

    const output = await bBlock.waitNextValue('#output');

    expect(output.v1).toBeInstanceOf(ErrorEvent);
    expect(output.v2).toBeInstanceOf(ErrorEvent);

    // delete flow;
    flow.deleteValue('b');
  });

  it('input race', function () {
    const flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#inputs', '1': 1},
          '#outputs': {'#is': '', '~#return': '##.add.#output'},
        },
      },
    });

    Root.runAll(2);

    expect(bBlock.getValue('#output')).toEqual({v1: 2, v2: 3, v3: 4});
    expect(TestFunctionRunner.popLogs().length).toBe(3);

    // set 2 inputs at same time
    flow.setValue('a', {
      v7: 7,
      v8: 8,
      v9: 9,
    });
    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.runAll(2);

    expect(bBlock.getValue('#output')).toEqual({v1: 2, v2: 5, v4: 6});

    expect(TestFunctionRunner.popLogs().length).toBe(3);

    // delete flow;
    flow.deleteValue('b');
  });

  it('cancel worker', async function () {
    const flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'async': {'#is': 'async-function-promise', '~#call': '##.#inputs'},
          'add': {
            '#is': 'add',
            '#mode': 'onCall',
            '~#call': '##.async.#emit',
            '~0': '##.#inputs',
            '1': 1,
          },
          '#outputs': {
            '#is': '',
            '~#return': '##.add.#output',
            '~#wait': '##.async.#wait',
          },
        },
      },
    });

    Root.run();

    bBlock.setValue('#cancel', {});
    await shouldTimeout(bBlock.waitNextValue('#output'), 10);

    expect(TestFunctionRunner.popLogs().length).toBe(3);

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.run();

    expect(await bBlock.waitNextValue('#output')).toEqual({
      v1: 2,
      v2: 5,
      v4: 6,
    });

    expect(TestFunctionRunner.popLogs().length).toBe(3);

    // delete flow;
    flow.deleteValue('b');
  });

  it('cancel worker reuse', async function () {
    const flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'reuse',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'async': {'#is': 'async-function-promise', '~#call': '##.#inputs'},
          'add': {
            '#is': 'add',
            '#mode': 'onCall',
            '~#call': '##.async.#emit',
            '~0': '##.#inputs',
            '1': 1,
          },
          '#outputs': {
            '#is': '',
            '~#return': '##.add.#output',
            '~#wait': '##.async.#wait',
          },
        },
      },
    });

    Root.run();

    expect(TestFunctionRunner.popLogs().length).toBe(3);
    bBlock.setValue('#cancel', {});

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.run();

    expect(await bBlock.waitValue('#output')).toEqual({v1: 2, v2: 5, v4: 6});

    expect(TestFunctionRunner.popLogs().length).toBe(1);

    // delete flow;
    flow.deleteValue('b');
  });
});
