import {assert} from 'chai';
import {Flow, Root} from '../../block/Flow';
import {TestFunctionRunner, TestAsyncFunctionPromise} from '../../block/spec/TestFunction';
import '../../functions/math/Arithmetic';
import '../MapFunction';
import {shouldHappen} from '../../util/test-util';

describe('MapFunction Thread', function () {
  beforeEach(() => {
    TestFunctionRunner.clearLog();
  });

  afterEach(() => {
    TestFunctionRunner.clearLog();
  });

  let inputObj: any = {};
  let inputArr: any[] = [];

  for (let i = 0; i < 20; ++i) {
    inputObj['v' + i] = i;
    inputArr.push(i + 100);
  }

  it('basic', async function () {
    let flow = new Flow();

    flow.setValue('a', inputObj);

    let bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'thread': 5,
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#inputs', '1': 1},
          '#outputs': {'#is': '', '~#value': '##.add.#output'},
        },
      },
    });

    Root.run();
    assert.isUndefined(bBlock.getValue('#output'), 'async worker should not finish right after run');

    let output = await bBlock.waitValue('#output');
    assert.lengthOf(Object.keys(output), 20);
    assert.lengthOf(TestFunctionRunner.popLogs(), 20);

    for (let i = 0; i < 20; ++i) {
      assert.equal(output['v' + i], i + 1);
    }

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    output = await bBlock.waitNextValue('#output');

    assert.deepEqual(output, {v1: 2, v2: 5, v4: 6}, 'input change');
    assert.lengthOf(TestFunctionRunner.popLogs(), 3);

    flow.setValue('a', inputArr);
    let outputArr = await bBlock.waitNextValue('#output');
    assert.lengthOf(outputArr, 20, 'output array');

    for (let i = 0; i < 20; ++i) {
      assert.equal(outputArr[i], i + 101);
    }

    assert.lengthOf(TestFunctionRunner.popLogs(), 20);

    // delete flow;
    flow.deleteValue('b');
  });

  it('input object', async function () {
    let flow = new Flow();

    const data = {
      v1: {v: 1},
      v2: {v: 2},
      v3: {v: 3},
    };

    flow.setValue('a', data);

    let bBlock = flow.createBlock('b');

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
    let output = await bBlock.waitValue('#output');
    assert.deepEqual(output, data);

    // delete flow;
    flow.deleteValue('b');
  });

  it('change use', async function () {
    let flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    let bBlock = flow.createBlock('b');

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
          '#outputs': {'#is': '', '~#value': '##.add.#output'},
        },
      },
    });

    Root.run();

    let output = await bBlock.waitValue('#output');
    assert.deepEqual(output, {v1: 2, v2: 3, v3: 4});

    bBlock.setValue('use', {
      '#is': '',
      'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
      'add': {'#is': 'add', '~0': '##.#inputs', '1': 2},
      '#outputs': {'#is': '', '~#value': '##.add.#output'},
    });

    Root.run();
    await shouldHappen(() => bBlock.getValue('#output') !== output);
    assert.deepEqual(bBlock.getValue('#output'), {v1: 3, v2: 4, v3: 5});

    assert.lengthOf(TestFunctionRunner.popLogs(), 2);

    // delete flow;
    flow.deleteValue('b');
  });

  it('async worker', async function () {
    let flow = new Flow();

    flow.setValue('a', inputObj);

    let bBlock = flow.createBlock('b');

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
            '~#value': '##.add.#output',
            '~#wait': '##.async.#wait',
          },
        },
      },
    });

    Root.run();
    assert.isUndefined(bBlock.getValue('#output'), 'async worker should not finish right after run');

    let output = await bBlock.waitValue('#output');
    assert.lengthOf(Object.keys(output), 20);
    assert.lengthOf(TestFunctionRunner.popLogs(), 20);

    for (let i = 0; i < 20; ++i) {
      assert.equal(output['v' + i], i + 1);
    }
    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    output = await bBlock.waitNextValue('#output');

    assert.deepEqual(output, {v1: 2, v2: 5, v4: 6}, 'input change');
    assert.lengthOf(TestFunctionRunner.popLogs(), 3);

    flow.setValue('a', inputArr);
    let outputArr = await bBlock.waitNextValue('#output');
    assert.lengthOf(outputArr, 20, 'output array');

    for (let i = 0; i < 20; ++i) {
      assert.equal(outputArr[i], i + 101);
    }

    assert.lengthOf(TestFunctionRunner.popLogs(), 20);

    // delete flow;
    flow.deleteValue('b');
  });

  it('async worker reuse', async function () {
    let flow = new Flow();

    flow.setValue('a', inputObj);

    let bBlock = flow.createBlock('b');

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
            '~#value': '##.add.#output',
            '~#wait': '##.async.#wait',
          },
        },
      },
    });

    Root.run();
    assert.isUndefined(bBlock.getValue('#output'), 'async worker should not finish right after run');

    let output = await bBlock.waitValue('#output');
    assert.lengthOf(Object.keys(output), 20);
    assert.lengthOf(TestFunctionRunner.popLogs(), 5);

    for (let i = 0; i < 20; ++i) {
      assert.equal(output['v' + i], i + 1);
    }

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    output = await bBlock.waitNextValue('#output');

    assert.deepEqual(output, {v1: 2, v2: 5, v4: 6}, 'input change');
    assert.lengthOf(TestFunctionRunner.popLogs(), 3);

    flow.setValue('a', inputArr);
    let outputArr = await bBlock.waitNextValue('#output');
    assert.lengthOf(outputArr, 20, 'output array');
    assert.lengthOf(TestFunctionRunner.popLogs(), 5);

    for (let i = 0; i < 20; ++i) {
      assert.equal(outputArr[i], i + 101);
    }

    // delete flow;
    flow.deleteValue('b');
  });

  it('async worker persist', async function () {
    let flow = new Flow();

    flow.setValue('a', inputObj);

    let bBlock = flow.createBlock('b');

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
            '~#value': '##.add.#output',
            '~#wait': '##.async.#wait',
          },
        },
      },
    });

    Root.run();
    assert.isUndefined(bBlock.getValue('#output'), 'async worker should not finish right after run');

    let output = await bBlock.waitValue('#output');
    assert.lengthOf(Object.keys(output), 20);

    for (let i = 0; i < 20; ++i) {
      assert.equal(output['v' + i], i + 1);
    }
    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    output = await bBlock.waitNextValue('#output');

    assert.deepEqual(output, {v1: 2, v2: 5, v4: 6}, 'input change');

    flow.setValue('a', inputArr);
    let outputArr = await bBlock.waitNextValue('#output');
    assert.lengthOf(outputArr, 20, 'output array');

    for (let i = 0; i < 20; ++i) {
      assert.equal(outputArr[i], i + 101);
    }
    assert.notEqual(bBlock.queryValue('#func.4.#outputs'), undefined, 'persist worker still exists');

    // delete flow;
    flow.deleteValue('b');
  });

  it('data race', async function () {
    let flow = new Flow();

    flow.setValue('a', inputObj);

    let bBlock = flow.createBlock('b');

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
            '~#value': '##.add.#output',
            '~#wait': '##.async.#wait',
          },
        },
      },
    });

    Root.run();
    assert.isUndefined(bBlock.getValue('#output'), 'async worker should not finish right after run');

    // set 3 inputs at same time
    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });
    flow.setValue('a', inputObj);
    flow.setValue('a', inputArr);

    let output = await bBlock.waitValue('#output');
    assert.lengthOf(Object.keys(output), 20);

    let outputArr = await bBlock.waitNextValue('#output');
    assert.lengthOf(outputArr, 20, 'output array');

    for (let i = 0; i < 20; ++i) {
      assert.equal(outputArr[i], i + 101);
    }

    assert.lengthOf(TestFunctionRunner.popLogs(), 40);

    // delete flow;
    flow.deleteValue('b');
  });
});
