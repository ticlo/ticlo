import {expect} from 'vitest';
import type {Block} from '../../block/Block.js';
import {Flow, Root} from '../../block/Flow.js';
import '../../functions/math/Arithmetic.js';
import '../HandlerFunction.js';
import type {DataMap} from '../../util/DataTypes.js';
import {convertToOutput} from '../../util/DataTypes.js';
import {DoneEvent, ErrorEvent, Event, WAIT} from '../../block/Event.js';
import {shouldHappen, shouldTimeout} from '../../util/test-util.js';
import {Task} from '../../block/Task.js';

const handlerWorker = {
  '#is': {
    '#is': '',
    'add': {'#is': 'add', '~0': '##.#inputs.n', '1': 1},
    '#inputs': {'#is': '', '#custom': [{name: 'n', type: 'number'}]},
    '#outputs': {'#is': '', '~#return': '##.add.#output'},
  },
};

const waitWorker = {
  '#is': {
    '#is': '',
    '#outputs': {'#is': '', '#wait': true},
  },
};

class TestTask extends Task {
  static logs: any[] = [];
  static popLogs(): any[] {
    const result = TestTask.logs;
    TestTask.logs = [];
    return result;
  }

  n: number;
  constructor(n: number) {
    super();
    this.n = n;
  }
  getDataMap(): any {
    return {n: this.n};
  }

  onResolve(worker: Block, output: any): DataMap {
    const result = convertToOutput(output);
    TestTask.logs.push(result);
    return result;
  }

  onTimeout(): any {
    TestTask.logs.push('timeout');
    return new ErrorEvent('timeout');
  }

  onCancel(): void {
    TestTask.logs.push('cancel');
  }
}

describe('TaskHandlerFunction', function () {
  it('basic', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');

    aBlock._load({
      '#is': 'handler',
      'use': handlerWorker,
    });

    aBlock.setValue('#call', new TestTask(1));

    Root.runAll(2);

    expect(TestTask.popLogs()).toEqual([2]);

    // delete handler;
    flow.deleteValue('a');
  });

  it('timeout', async function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');

    aBlock._load({
      '#is': 'handler',
      'timeout': 0.01,
      'use': waitWorker,
    });

    aBlock.setValue('#call', new TestTask(1));

    Root.run();
    await shouldHappen(() => TestTask.logs.length);
    expect(TestTask.popLogs()).toEqual(['timeout']);

    // delete handler;
    flow.deleteValue('a');
  });

  it('cancel', async function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');

    aBlock._load({
      '#is': 'handler',
      'use': waitWorker,
    });

    aBlock.setValue('#call', new TestTask(1));

    Root.run();
    aBlock.setValue('#cancel', {});

    expect(TestTask.popLogs()).toEqual(['cancel']);

    // delete handler;
    flow.deleteValue('a');
  });
});
