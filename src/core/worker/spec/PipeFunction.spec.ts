import {assert} from 'chai';
import {Job, Root} from '../../block/Block';
import {TestFunctionRunner, TestAsyncFunctionLog} from '../../block/spec/TestFunction';
import '../../functions/basic/math/Arithmetic';
import '../PipeFunction';
import {DataMap} from '../../util/DataTypes';
import {CompleteEvent, Event, NOT_READY} from '../../block/Event';
import {shouldHappen, shouldTimeout} from '../../util/test-util';

class PipeListener {
  ignoreEvent: boolean;
  constructor(ignoreEvent = false) {
    this.ignoreEvent = ignoreEvent;
  }
  emits: any[] = [];
  onChange(val: any) {
    if (val) {
      if (this.ignoreEvent && val instanceof Event) {
        return;
      }
      if (val.constructor === CompleteEvent) {
        return;
      }
      this.emits.push(val);
    }
  }
  onSourceChange(prop: any): void {}
}

const pipeWorker = {
  '#is': {
    '#is': '',
    'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
    'add': {'#is': 'add', '~0': '##.#input', '1': 1},
    '#output': {'#is': '', '~#value': '##.add.output'}
  }
};

describe('PipeFunction', function() {
  beforeEach(() => {
    TestFunctionRunner.clearLog();
  });

  afterEach(() => {
    TestFunctionRunner.clearLog();
  });

  it('basic', function() {
    let job = new Job();

    let listener = new PipeListener();
    let aBlock = job.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'pipe',
      '#call': 1,
      'use': pipeWorker
    });

    Root.runAll(2);

    assert.deepEqual(listener.emits, [NOT_READY, 2]);

    // delete pipe;
    job.deleteValue('a');
  });

  it('syncInput', function() {
    let job = new Job();

    let listener = new PipeListener();
    let aBlock = job.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'pipe',
      '#sync': true,
      'use': pipeWorker
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    Root.run();

    assert.deepEqual(listener.emits, [NOT_READY, 5, 4, 3, 2]);

    assert.lengthOf(TestFunctionRunner.popLogs(), 4);

    // delete pipe;
    job.deleteValue('a');
  });

  it('thread non-reuse', function() {
    let job = new Job();

    let listener = new PipeListener();
    let aBlock = job.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'pipe',
      '#sync': true,
      'thread': 2,
      'use': pipeWorker
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    Root.runAll();

    assert.deepEqual(listener.emits, [NOT_READY, 5, 4, NOT_READY, 3, 2]);

    assert.lengthOf(TestFunctionRunner.popLogs(), 4);

    // delete pipe;
    job.deleteValue('a');
  });

  it('thread reuse', function() {
    let job = new Job();

    let listener = new PipeListener();
    let aBlock = job.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'pipe',
      '#sync': true,
      'thread': 2,
      'reuseWorker': 'reuse',
      'use': pipeWorker
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    Root.runAll();

    assert.deepEqual(listener.emits, [NOT_READY, 5, 4, NOT_READY, 3, 2]);

    assert.lengthOf(TestFunctionRunner.popLogs(), 2);

    aBlock.setValue('#call', 0);
    Root.runAll();
    assert.deepEqual(listener.emits, [NOT_READY, 5, 4, NOT_READY, 3, 2, NOT_READY, 1]);

    assert.lengthOf(TestFunctionRunner.popLogs(), 1); // a new worker is created

    // delete pipe;
    job.deleteValue('a');
  });

  it('thread persist', function() {
    let job = new Job();

    let listener = new PipeListener();
    let aBlock = job.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'pipe',
      '#sync': true,
      'thread': 2,
      'reuseWorker': 'persist',
      'use': pipeWorker
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    Root.runAll();

    assert.deepEqual(listener.emits, [NOT_READY, 5, 4, NOT_READY, 3, 2]);

    assert.lengthOf(TestFunctionRunner.popLogs(), 2);

    aBlock.setValue('#call', 0);
    Root.runAll();
    assert.deepEqual(listener.emits, [NOT_READY, 5, 4, NOT_READY, 3, 2, NOT_READY, 1]);

    assert.isEmpty(TestFunctionRunner.popLogs()); // no new worker is created

    // delete pipe;
    job.deleteValue('a');
  });

  it('keepOrder', async function() {
    let job = new Job();

    let listener = new PipeListener(true);
    let aBlock = job.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'pipe',
      '#sync': true,
      'reuseWorker': 'reuse',
      'keepOrder': true,
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'async-function-manual', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#input', '1': 1},
          '#output': {'#is': '', '~#value': '##.add.output', '~#wait': '##.runner.#wait'}
        }
      }
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    aBlock.setValue('#call', 0);
    Root.run();

    await shouldHappen(() => listener.emits.length === 5);

    assert.deepEqual(listener.emits, [5, 4, 3, 2, 1]);

    // delete pipe;
    job.deleteValue('a');
  });

  it('timeout', async function() {
    let job = new Job();

    let listener = new PipeListener();
    let aBlock = job.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'pipe',
      '#sync': true,
      'timeout': 10,
      'use': {
        '#is': {
          '#is': '',
          '#output': {'#is': '', '#wait': true}
        }
      }
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    Root.runAll();

    assert.deepEqual(listener.emits, [NOT_READY]);

    aBlock.setValue('timeout', 0.01);
    await shouldHappen(() => listener.emits.length >= 5);

    // delete pipe;
    job.deleteValue('a');
  });

  it('maxQueueSize', async function() {
    let job = new Job();

    let listener = new PipeListener(true);
    let aBlock = job.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'pipe',
      '#sync': true,
      'maxQueueSize': 2,
      'thread': 1,
      'use': pipeWorker
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    aBlock.setValue('#call', 0);

    Root.run();

    await shouldHappen(() => listener.emits.length >= 3);

    assert.deepEqual(listener.emits, [5, 2, 1]);

    // delete pipe;
    job.deleteValue('a');
  });

  it('chain pipe blocks', async function() {
    let job = new Job();

    job.load({
      a: {
        '#is': 'pipe',
        '#sync': true,
        'use': pipeWorker
      },
      b: {
        '~#call': '##.a.#emit',
        '#is': 'pipe',
        '#sync': true,
        'use': pipeWorker
      }
    });
    let listener = new PipeListener();

    let aBlock = job.getValue('a');

    job.queryProperty('b.#emit', true).listen(listener);

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);

    Root.runAll();
    assert.deepEqual(listener.emits, [NOT_READY, 6, 5]);

    assert.lengthOf(TestFunctionRunner.popLogs(), 4);
    // delete pipe;
    job.deleteValue('a');
  });

  it('misc', async function() {
    let job = new Job();

    let listener = new PipeListener(true);
    let aBlock = job.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'pipe',
      '#sync': true,
      'thread': 1,
      'use': pipeWorker
    });

    // invalid parameters
    aBlock.setValue('keepOrder', '');
    aBlock.setValue('invalidParameter', '');
    aBlock.setValue('maxQueueSize', -1);

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);

    // change queue size when the queue already exists
    aBlock.setValue('maxQueueSize', 1);

    Root.run();

    await shouldHappen(() => listener.emits.length >= 2);

    assert.deepEqual(listener.emits, [5, 3]);

    // delete pipe;
    job.deleteValue('a');
  });
});
