import {expect} from 'vitest';
import {Flow, Root} from '../../block/Flow.js';
import {TestFunctionRunner, TestAsyncFunctionPromise} from '../../block/__spec__/TestFunction.js';
import '../../functions/math/Arithmetic.js';
import '../MapFunction.js';
import {shouldHappen} from '../../util/test-util.js';

describe('MapFunction Thread', function () {
  beforeEach(() => {
    TestFunctionRunner.clearLog();
  });

  afterEach(() => {
    TestFunctionRunner.clearLog();
  });

  const inputObj: any = {};
  const inputArr: any[] = [];

  for (let i = 0; i < 20; ++i) {
    inputObj['v' + i] = i;
    inputArr.push(i + 100);
  }

  it('basic', async function () {
    const flow = new Flow();

    flow.setValue('a', inputObj);

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'thread': 5,
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
    expect(bBlock.getValue('#output')).not.toBeDefined();

    let output = await bBlock.waitValue('#output');
    expect(Object.keys(output).length).toBe(20);
    expect(TestFunctionRunner.popLogs().length).toBe(20);

    for (let i = 0; i < 20; ++i) {
      expect(output['v' + i]).toBe(i + 1);
    }

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    output = await bBlock.waitNextValue('#output');

    expect(output).toEqual({v1: 2, v2: 5, v4: 6});
    expect(TestFunctionRunner.popLogs().length).toBe(3);

    flow.setValue('a', inputArr);
    const outputArr = await bBlock.waitNextValue('#output');
    expect(outputArr.length).toBe(20);

    for (let i = 0; i < 20; ++i) {
      expect(outputArr[i]).toBe(i + 101);
    }

    expect(TestFunctionRunner.popLogs().length).toBe(20);

    // delete flow;
    flow.deleteValue('b');
  });

  it('input object', async function () {
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
      'thread': 1,
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          '#outputs': {'#is': '', '~v': '##.#inputs.v'},
        },
      },
    });

    Root.run();
    const output = await bBlock.waitValue('#output');
    expect(output).toEqual(data);

    // delete flow;
    flow.deleteValue('b');
  });

  it('change use', async function () {
    const flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'thread': 1,
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

    const output = await bBlock.waitValue('#output');
    expect(output).toEqual({v1: 2, v2: 3, v3: 4});

    bBlock.setValue('use', {
      '#is': '',
      'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
      'add': {'#is': 'add', '~0': '##.#inputs', '1': 2},
      '#outputs': {'#is': '', '~#return': '##.add.#output'},
    });

    Root.run();
    await shouldHappen(() => bBlock.getValue('#output') !== output);
    expect(bBlock.getValue('#output')).toEqual({v1: 3, v2: 4, v3: 5});

    expect(TestFunctionRunner.popLogs().length).toBe(2);

    // delete flow;
    flow.deleteValue('b');
  });

  it('async worker', async function () {
    const flow = new Flow();

    flow.setValue('a', inputObj);

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'thread': 5,
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'async': {'#is': 'async-function-manual', '~#call': '##.#inputs'},
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

    let output = await bBlock.waitValue('#output');
    expect(Object.keys(output).length).toBe(20);
    expect(TestFunctionRunner.popLogs().length).toBe(20);

    for (let i = 0; i < 20; ++i) {
      expect(output['v' + i]).toBe(i + 1);
    }
    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    output = await bBlock.waitNextValue('#output');

    expect(output).toEqual({v1: 2, v2: 5, v4: 6});
    expect(TestFunctionRunner.popLogs().length).toBe(3);

    flow.setValue('a', inputArr);
    const outputArr = await bBlock.waitNextValue('#output');
    expect(outputArr.length).toBe(20);

    for (let i = 0; i < 20; ++i) {
      expect(outputArr[i]).toBe(i + 101);
    }

    expect(TestFunctionRunner.popLogs().length).toBe(20);

    // delete flow;
    flow.deleteValue('b');
  });

  it('async worker reuse', async function () {
    const flow = new Flow();

    flow.setValue('a', inputObj);

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'reuse',
      'thread': 5,
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

    let output = await bBlock.waitValue('#output');
    expect(Object.keys(output).length).toBe(20);
    expect(TestFunctionRunner.popLogs().length).toBe(5);

    for (let i = 0; i < 20; ++i) {
      expect(output['v' + i]).toBe(i + 1);
    }

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    output = await bBlock.waitNextValue('#output');

    expect(output).toEqual({v1: 2, v2: 5, v4: 6});
    expect(TestFunctionRunner.popLogs().length).toBe(3);

    flow.setValue('a', inputArr);
    const outputArr = await bBlock.waitNextValue('#output');
    expect(outputArr.length).toBe(20);
    expect(TestFunctionRunner.popLogs().length).toBe(5);

    for (let i = 0; i < 20; ++i) {
      expect(outputArr[i]).toBe(i + 101);
    }

    // delete flow;
    flow.deleteValue('b');
  });

  it('async worker persist', async function () {
    const flow = new Flow();

    flow.setValue('a', inputObj);

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'persist',
      'thread': 5,
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

    let output = await bBlock.waitValue('#output');
    expect(Object.keys(output).length).toBe(20);

    for (let i = 0; i < 20; ++i) {
      expect(output['v' + i]).toBe(i + 1);
    }
    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    output = await bBlock.waitNextValue('#output');

    expect(output).toEqual({v1: 2, v2: 5, v4: 6});

    flow.setValue('a', inputArr);
    const outputArr = await bBlock.waitNextValue('#output');
    expect(outputArr.length).toBe(20);

    for (let i = 0; i < 20; ++i) {
      expect(outputArr[i]).toBe(i + 101);
    }
    expect(bBlock.queryValue('#flows.4.#outputs')).not.toBe(undefined);

    // delete flow;
    flow.deleteValue('b');
  });

  it('data race', async function () {
    const flow = new Flow();

    flow.setValue('a', inputObj);

    const bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'thread': 5,
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

    // set 3 inputs at same time
    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });
    flow.setValue('a', inputObj);
    flow.setValue('a', inputArr);

    const output = await bBlock.waitValue('#output');
    expect(Object.keys(output).length).toBe(20);

    const outputArr = await bBlock.waitNextValue('#output');
    expect(outputArr.length).toBe(20);

    for (let i = 0; i < 20; ++i) {
      expect(outputArr[i]).toBe(i + 101);
    }

    expect(TestFunctionRunner.popLogs().length).toBe(40);

    // delete flow;
    flow.deleteValue('b');
  });
});
