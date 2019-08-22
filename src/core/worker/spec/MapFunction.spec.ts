import {assert} from "chai";
import {Job, Root} from "../../block/Block";
import {TestFunctionRunner, TestAsyncFunctionPromise} from "../../block/spec/TestFunction";
import "../../functions/basic/Math";
import "../MapFunction";
import {DataMap} from "../../util/Types";
import {ErrorEvent} from "../../block/Event";
import {shouldTimeout} from "../../util/test-util";


describe("MapFunction Basic", function () {
  beforeEach(() => {
    TestFunctionRunner.clearLog();
  });

  afterEach(() => {
    TestFunctionRunner.clearLog();
  });

  it('basic', function () {

    let job = new Job();

    job.setValue('a', {
      'v1': 1,
      'v2': 2,
      'v3': 3
    });

    let bBlock = job.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#input', '1': 1},
          '#output': {'#is': '', '~#value': '##.add.output'}
        }
      }
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 3, 'v3': 4});

    job.setValue('a', {
      'v1': 1,
      'v2': 4,
      'v4': 5
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 5, 'v4': 6});

    assert.lengthOf(TestFunctionRunner.popLogs(), 6);

    // delete job;
    job.deleteValue('b');
  });

  it('reuse worker', function () {

    let job = new Job();

    job.setValue('a', {
      'v1': 1,
      'v2': 2,
      'v3': 3
    });

    let bBlock = job.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'reuse',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#input', '1': 1},
          '#output': {'#is': '', '~#value': '##.add.output'}
        }
      }
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 3, 'v3': 4});

    job.setValue('a', {
      'v1': 1,
      'v2': 4,
      'v4': 5
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 5, 'v4': 6});
    assert.isUndefined(bBlock.queryValue('#func.v3.#output'), 'unused worker should be removed');

    assert.lengthOf(TestFunctionRunner.popLogs(), 4);


    // delete job;
    job.deleteValue('b');
  });

  it('persist worker', function () {

    let job = new Job();

    job.setValue('a', {
      'v1': 1,
      'v2': 2,
      'v3': 3
    });

    let bBlock = job.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'persist',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#input', '1': 1},
          '#output': {'#is': '', '~#value': '##.add.output'}
        }
      }
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 3, 'v3': 4});

    job.setValue('a', {
      'v1': 1,
      'v2': 4,
      'v4': 5
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 5, 'v4': 6});
    assert.equal(bBlock.queryValue('#func.v3.#output.#value'), 4, 'unused worker is still kept');

    assert.lengthOf(TestFunctionRunner.popLogs(), 4);


    // delete job;
    job.deleteValue('b');
  });

  it('conversion from Block', function () {
    let job = new Job();

    let aBlock = job.createBlock('a');
    let bBlock = job.createBlock('b');

    aBlock._load({
      '#is': '',
      'obj1': {'#is': '', 'v': 1},
      'obj2': {'#is': '', 'v': 2},
      'obj3': {'v': 3}
    });

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'reuse',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'add': {'#is': 'add', '~0': '##.#input.v', '1': 1},
          '#output': {'#is': '', '~v': '##.add.output'}
        }
      }
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('output'), {'obj1': {'v': 2}, 'obj2': {'v': 3}, 'obj3': {'v': 4}});

    // delete job;
    job.deleteValue('b');
  });

  it('async worker', async function () {

    let job = new Job();

    job.setValue('a', {
      'v1': 1,
      'v2': 2,
      'v3': 3
    });

    let bBlock = job.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'async': {'#is': 'async-function-promise', '~#call': '##.#input'},
          'add': {'#is': 'add', '#mode': 'onCall', '~#call': '##.async.#emit', '~0': '##.#input', '1': 1},
          '#output': {'#is': '', '~#value': '##.add.output', '~#wait': '##.async.#wait'}
        }
      }
    });

    Root.run();

    assert.isUndefined(bBlock.getValue('output'), 'async worker should not finish right after run');

    assert.deepEqual(await bBlock.waitNextValue('output'), {'v1': 2, 'v2': 3, 'v3': 4}, 'async workers finish');

    job.setValue('a', {
      'v1': 1,
      'v2': 4,
      'v4': 5
    });

    Root.run();

    assert.deepEqual(await bBlock.waitNextValue('output'), {'v1': 2, 'v2': 5, 'v4': 6});

    assert.lengthOf(TestFunctionRunner.popLogs(), 6);


    // delete job;
    job.deleteValue('b');

  });

  it('timeout', async function () {
    let job = new Job();

    job.setValue('a', {
      'v1': 1,
      'v2': 2
    });

    let bBlock = job.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          '#wait': true
        }
      }
    });

    // without timeout, block would never have output
    await shouldTimeout(bBlock.waitNextValue('output'), 10);

    bBlock.setValue('timeout', 0.01);

    let output = await bBlock.waitNextValue('output');

    assert.instanceOf(output.v1, ErrorEvent, 'value is timeout error');
    assert.instanceOf(output.v2, ErrorEvent, 'value is timeout error');

    // delete job;
    job.deleteValue('b');
  });

  it('input race', function () {

    let job = new Job();

    job.setValue('a', {
      'v1': 1,
      'v2': 2,
      'v3': 3
    });

    let bBlock = job.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#input', '1': 1},
          '#output': {'#is': '', '~#value': '##.add.output'}
        }
      }
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 3, 'v3': 4});
    assert.lengthOf(TestFunctionRunner.popLogs(), 3);

    // set 2 inputs at same time
    job.setValue('a', {
      'v7': 7,
      'v8': 8,
      'v9': 9
    });
    job.setValue('a', {
      'v1': 1,
      'v2': 4,
      'v4': 5
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 5, 'v4': 6});

    assert.lengthOf(TestFunctionRunner.popLogs(), 3);

    // delete job;
    job.deleteValue('b');
  });

  it('cancel worker', async function () {

    let job = new Job();

    job.setValue('a', {
      'v1': 1,
      'v2': 2,
      'v3': 3
    });

    let bBlock = job.createBlock('b');

    bBlock._load({
      '#is': 'map',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'async': {'#is': 'async-function-promise', '~#call': '##.#input'},
          'add': {'#is': 'add', '#mode': 'onCall', '~#call': '##.async.#emit', '~0': '##.#input', '1': 1},
          '#output': {'#is': '', '~#value': '##.add.output', '~#wait': '##.async.#wait'}
        }
      }
    });

    Root.run();

    bBlock.setValue('#cancel', {});
    await shouldTimeout(bBlock.waitNextValue('output'), 10);

    assert.lengthOf(TestFunctionRunner.popLogs(), 3);

    job.setValue('a', {
      'v1': 1,
      'v2': 4,
      'v4': 5
    });

    Root.run();

    assert.deepEqual(await bBlock.waitNextValue('output'), {'v1': 2, 'v2': 5, 'v4': 6});

    assert.lengthOf(TestFunctionRunner.popLogs(), 3);

    // delete job;
    job.deleteValue('b');

  });

  it('cancel worker reuse', async function () {

    let job = new Job();

    job.setValue('a', {
      'v1': 1,
      'v2': 2,
      'v3': 3
    });

    let bBlock = job.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'reuse',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'async': {'#is': 'async-function-promise', '~#call': '##.#input'},
          'add': {'#is': 'add', '#mode': 'onCall', '~#call': '##.async.#emit', '~0': '##.#input', '1': 1},
          '#output': {'#is': '', '~#value': '##.add.output', '~#wait': '##.async.#wait'}
        }
      }
    });

    Root.run();

    assert.lengthOf(TestFunctionRunner.popLogs(), 3);
    bBlock.setValue('#cancel', {});

    job.setValue('a', {
      'v1': 1,
      'v2': 4,
      'v4': 5
    });

    Root.run();

    assert.deepEqual(await bBlock.waitValue('output'), {'v1': 2, 'v2': 5, 'v4': 6});

    assert.lengthOf(TestFunctionRunner.popLogs(), 1);

    // delete job;
    job.deleteValue('b');

  });
});
