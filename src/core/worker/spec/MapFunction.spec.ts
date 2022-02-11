import {assert} from 'chai';
import {Flow, Root} from '../../block/Flow';
import {TestFunctionRunner, TestAsyncFunctionPromise} from '../../block/spec/TestFunction';
import '../../functions/math/Arithmetic';
import '../MapFunction';
import {DataMap} from '../../util/DataTypes';
import {ErrorEvent} from '../../block/Event';
import {shouldTimeout} from '../../util/test-util';

describe('MapFunction non-thread', function () {
  beforeEach(() => {
    TestFunctionRunner.clearLog();
  });

  afterEach(() => {
    TestFunctionRunner.clearLog();
  });

  it('basic', function () {
    let flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    let bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
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

    Root.runAll(2);

    assert.deepEqual(bBlock.getValue('#output'), {v1: 2, v2: 3, v3: 4});

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.runAll(2);

    assert.deepEqual(bBlock.getValue('#output'), {v1: 2, v2: 5, v4: 6});

    assert.lengthOf(TestFunctionRunner.popLogs(), 6);

    // delete flow;
    flow.deleteValue('b');
  });

  it('empty input', function () {
    let flow = new Flow();

    let bBlock = flow.createBlock('b');

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
    assert.deepEqual(bBlock.getValue('#output'), {});

    flow.deleteValue('b');
  });

  it('#inputs', function () {
    let flow = new Flow();

    flow.setValue('a', {
      v1: {a: 1, b: 2},
      v2: {a: 3, b: 4},
    });

    let bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          '#outputs': {'#is': '', '~#value': '##.#inputs.a'},
        },
      },
    });
    Root.runAll(2);
    assert.deepEqual(bBlock.getValue('#output'), {v1: 1, v2: 3});

    bBlock.setValue('use', {
      '#is': '',
      '#inputs': {'#is': ''},
      '#outputs': {'#is': '', '~#value': '##.#inputs.#value.b'},
    });

    Root.runAll(2);
    assert.deepEqual(bBlock.getValue('#output'), {v1: 2, v2: 4});

    bBlock.setValue('use', {
      '#is': '',
      '#inputs': {'#is': '', '#custom': [{name: 'a', type: 'number'}]},
      '#outputs': {'#is': '', '~#value': '##.#inputs.a'},
    });

    Root.runAll(2);
    assert.deepEqual(bBlock.getValue('#output'), {v1: 1, v2: 3});

    // delete flow;
    flow.deleteValue('b');
  });

  it('input object', function () {
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
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          '#outputs': {'#is': '', '~v': '##.#inputs.v'},
        },
      },
    });

    Root.runAll(2);

    assert.deepEqual(bBlock.getValue('#output'), data);

    // delete flow;
    flow.deleteValue('b');
  });

  it('change use', function () {
    let flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    let bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
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

    Root.runAll(2);

    assert.deepEqual(bBlock.getValue('#output'), {v1: 2, v2: 3, v3: 4});

    bBlock.setValue('use', {
      '#is': '',
      'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
      'add': {'#is': 'add', '~0': '##.#inputs', '1': 2},
      '#outputs': {'#is': '', '~#value': '##.add.#output'},
    });

    Root.runAll(2);

    assert.deepEqual(bBlock.getValue('#output'), {v1: 3, v2: 4, v3: 5});

    assert.lengthOf(TestFunctionRunner.popLogs(), 6);

    // delete flow;
    flow.deleteValue('b');
  });

  it('reuse worker', function () {
    let flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    let bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
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

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('#output'), {v1: 2, v2: 3, v3: 4});

    Root.run();

    assert.deepEqual(bBlock.getValue('#output'), {v1: 2, v2: 5, v4: 6});
    assert.isUndefined(bBlock.queryValue('#flow.v3.#outputs'), 'unused worker should be removed');

    assert.lengthOf(TestFunctionRunner.popLogs(), 4);

    // delete flow;
    flow.deleteValue('b');
  });

  it('persist worker', function () {
    let flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    let bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'persist',
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

    Root.runAll(2);

    assert.deepEqual(bBlock.getValue('#output'), {v1: 2, v2: 3, v3: 4});

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.runAll(2);

    assert.deepEqual(bBlock.getValue('#output'), {v1: 2, v2: 5, v4: 6});
    assert.equal(bBlock.queryValue('#flow.v3.#outputs.#value'), 4, 'unused worker is still kept');

    assert.lengthOf(TestFunctionRunner.popLogs(), 4);

    // delete flow;
    flow.deleteValue('b');
  });

  it('conversion from Block', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    let bBlock = flow.createBlock('b');

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

    assert.deepEqual(bBlock.getValue('#output'), {
      obj1: {v: 2},
      obj2: {v: 3},
      obj3: {v: 4},
    });

    // delete flow;
    flow.deleteValue('b');
  });

  it('async worker', async function () {
    let flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    let bBlock = flow.createBlock('b');

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
            '~#value': '##.add.#output',
            '~#wait': '##.async.#wait',
          },
        },
      },
    });

    Root.run();

    assert.isUndefined(bBlock.getValue('#output'), 'async worker should not finish right after run');

    assert.deepEqual(await bBlock.waitNextValue('#output'), {v1: 2, v2: 3, v3: 4}, 'async workers finish');

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.run();

    assert.deepEqual(await bBlock.waitNextValue('#output'), {
      v1: 2,
      v2: 5,
      v4: 6,
    });

    assert.lengthOf(TestFunctionRunner.popLogs(), 6);

    // delete flow;
    flow.deleteValue('b');
  });

  it('timeout', async function () {
    let flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
    });

    let bBlock = flow.createBlock('b');

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

    let output = await bBlock.waitNextValue('#output');

    assert.instanceOf(output.v1, ErrorEvent, 'value is timeout error');
    assert.instanceOf(output.v2, ErrorEvent, 'value is timeout error');

    // delete flow;
    flow.deleteValue('b');
  });

  it('input race', function () {
    let flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    let bBlock = flow.createBlock('b');

    bBlock._load({
      '#is': 'map',
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

    Root.runAll(2);

    assert.deepEqual(bBlock.getValue('#output'), {v1: 2, v2: 3, v3: 4});
    assert.lengthOf(TestFunctionRunner.popLogs(), 3);

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

    assert.deepEqual(bBlock.getValue('#output'), {v1: 2, v2: 5, v4: 6});

    assert.lengthOf(TestFunctionRunner.popLogs(), 3);

    // delete flow;
    flow.deleteValue('b');
  });

  it('cancel worker', async function () {
    let flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    let bBlock = flow.createBlock('b');

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
            '~#value': '##.add.#output',
            '~#wait': '##.async.#wait',
          },
        },
      },
    });

    Root.run();

    bBlock.setValue('#cancel', {});
    await shouldTimeout(bBlock.waitNextValue('#output'), 10);

    assert.lengthOf(TestFunctionRunner.popLogs(), 3);

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.run();

    assert.deepEqual(await bBlock.waitNextValue('#output'), {
      v1: 2,
      v2: 5,
      v4: 6,
    });

    assert.lengthOf(TestFunctionRunner.popLogs(), 3);

    // delete flow;
    flow.deleteValue('b');
  });

  it('cancel worker reuse', async function () {
    let flow = new Flow();

    flow.setValue('a', {
      v1: 1,
      v2: 2,
      v3: 3,
    });

    let bBlock = flow.createBlock('b');

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
            '~#value': '##.add.#output',
            '~#wait': '##.async.#wait',
          },
        },
      },
    });

    Root.run();

    assert.lengthOf(TestFunctionRunner.popLogs(), 3);
    bBlock.setValue('#cancel', {});

    flow.setValue('a', {
      v1: 1,
      v2: 4,
      v4: 5,
    });

    Root.run();

    assert.deepEqual(await bBlock.waitValue('#output'), {v1: 2, v2: 5, v4: 6});

    assert.lengthOf(TestFunctionRunner.popLogs(), 1);

    // delete flow;
    flow.deleteValue('b');
  });
});
