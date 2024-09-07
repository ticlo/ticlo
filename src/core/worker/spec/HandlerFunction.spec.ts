import {expect} from 'vitest';
import {Flow, Root} from '../../block/Flow';
import {TestFunctionRunner, TestAsyncFunctionLog} from '../../block/spec/TestFunction';
import '../../functions/math/Arithmetic';
import '../HandlerFunction';
import {DataMap} from '../../util/DataTypes';
import {DoneEvent, Event, WAIT} from '../../block/Event';
import {shouldHappen, shouldTimeout} from '../../util/test-util';
import {Block} from '../../block/Block';

class HandlerListener {
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
      this.emits.push(val);
    }
  }
  onSourceChange(prop: any): void {}
}

const handlerWorker = {
  '#is': {
    '#is': '',
    'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
    'add': {'#is': 'add', '~0': '##.#inputs.#value', '1': 1},
    '#inputs': {'#is': ''},
    '#outputs': {'#is': '', '~#value': '##.add.#output'},
  },
};

describe('HandlerFunction', function () {
  beforeEach(() => {
    TestFunctionRunner.clearLog();
  });

  afterEach(() => {
    TestFunctionRunner.clearLog();
  });

  it('basic', function () {
    let flow = new Flow();

    let listener = new HandlerListener();
    let aBlock = flow.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'handler',
      '#call': 1,
      'use': handlerWorker,
    });

    Root.runAll(2);

    expect(listener.emits).toEqual([WAIT, 2]);

    // delete handler;
    flow.deleteValue('a');
  });

  it('syncInput', function () {
    let flow = new Flow();

    let listener = new HandlerListener();
    let aBlock = flow.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'handler',
      '#sync': true,
      'use': handlerWorker,
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    Root.run();

    expect(listener.emits).toEqual([WAIT, 5, 4, 3, 2]);

    expect(TestFunctionRunner.popLogs().length).toBe(4);

    // delete handler;
    flow.deleteValue('a');
  });

  it('thread non-reuse', function () {
    let flow = new Flow();

    let listener = new HandlerListener();
    let aBlock = flow.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'handler',
      'thread': 2,
      'use': handlerWorker,
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    Root.runAll();

    expect(listener.emits).toEqual([WAIT, 5, 4, WAIT, 3, 2]);

    expect(TestFunctionRunner.popLogs().length).toBe(4);

    // delete handler;
    flow.deleteValue('a');
  });

  it('thread reuse', function () {
    let flow = new Flow();

    let listener = new HandlerListener();
    let aBlock = flow.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'handler',
      'thread': 2,
      'reuseWorker': 'reuse',
      'use': handlerWorker,
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    Root.runAll();

    expect(listener.emits).toEqual([WAIT, 5, 4, WAIT, 3, 2]);

    expect(TestFunctionRunner.popLogs().length).toBe(2);

    aBlock.setValue('#call', 0);
    Root.runAll();
    expect(listener.emits).toEqual([WAIT, 5, 4, WAIT, 3, 2, WAIT, 1]);

    expect(TestFunctionRunner.popLogs().length).toBe(1); // a new worker is created

    // delete handler;
    flow.deleteValue('a');
  });

  it('thread persist', function () {
    let flow = new Flow();

    let listener = new HandlerListener();
    let aBlock = flow.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'handler',
      'thread': 2,
      'reuseWorker': 'persist',
      'use': handlerWorker,
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    Root.runAll();

    expect(listener.emits).toEqual([WAIT, 5, 4, WAIT, 3, 2]);

    expect(TestFunctionRunner.popLogs().length).toBe(2);

    aBlock.setValue('#call', 0);
    Root.runAll();
    expect(listener.emits).toEqual([WAIT, 5, 4, WAIT, 3, 2, WAIT, 1]);

    expect(TestFunctionRunner.popLogs()).toEqual([]); // no new worker is created

    // delete handler;
    flow.deleteValue('a');
  });

  it('keepOrder', async function () {
    let flow = new Flow();

    let listener = new HandlerListener(true);
    let aBlock = flow.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'handler',
      'reuseWorker': 'reuse',
      'keepOrder': true,
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'async-function-manual', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#inputs.#value', '1': 1},
          '#inputs': {'#is': ''},
          '#outputs': {'#is': '', '~#value': '##.add.#output', '~#wait': '##.runner.#wait'},
        },
      },
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    aBlock.setValue('#call', 0);
    Root.run();

    await shouldHappen(() => listener.emits.length === 5);

    expect(listener.emits).toEqual([5, 4, 3, 2, 1]);

    // delete handler;
    flow.deleteValue('a');
  });

  it('timeout', async function () {
    let flow = new Flow();

    let listener = new HandlerListener();
    let aBlock = flow.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'handler',
      'timeout': 10,
      'use': {
        '#is': {
          '#is': '',
          '#outputs': {'#is': '', '#wait': true},
        },
      },
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    Root.runAll();

    expect(listener.emits).toEqual([WAIT]);

    aBlock.setValue('timeout', 0.01);
    await shouldHappen(() => listener.emits.length >= 5);

    // delete handler;
    flow.deleteValue('a');
  });

  it('maxQueueSize', async function () {
    let flow = new Flow();

    let listener = new HandlerListener(true);
    let aBlock = flow.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'handler',
      '#sync': true,
      'maxQueueSize': 2,
      'thread': 1,
      'use': handlerWorker,
    });

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);
    aBlock.setValue('#call', 2);
    aBlock.setValue('#call', 1);
    aBlock.setValue('#call', 0);

    Root.run();

    await shouldHappen(() => listener.emits.length >= 3);

    expect(listener.emits).toEqual([5, 2, 1]);

    // delete handler;
    flow.deleteValue('a');
  });

  it('chain handler blocks', async function () {
    let flow = new Flow();

    flow.load({
      a: {
        '#is': 'handler',
        'use': handlerWorker,
      },
      b: {
        '~#call': '##.a.#emit',
        '#is': 'handler',
        'use': handlerWorker,
      },
    });
    let listener = new HandlerListener();

    let aBlock = flow.getValue('a') as Block;

    flow.queryProperty('b.#emit', true).listen(listener);

    aBlock.setValue('#call', 4);
    aBlock.setValue('#call', 3);

    Root.runAll();
    expect(listener.emits).toEqual([WAIT, 6, 5]);

    expect(TestFunctionRunner.popLogs().length).toBe(4);
    // delete handler;
    flow.deleteValue('a');
  });

  it('misc', async function () {
    let flow = new Flow();

    let listener = new HandlerListener(true);
    let aBlock = flow.createBlock('a');

    aBlock.getProperty('#emit').listen(listener);
    aBlock._load({
      '#is': 'handler',
      '#sync': true,
      'thread': 1,
      'use': handlerWorker,
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

    expect(listener.emits).toEqual([5, 3]);

    // delete handler;
    flow.deleteValue('a');
  });
});
