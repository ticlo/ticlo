import {assert} from 'chai';
import {Job, Root} from '../../block/Block';
import '../../functions/basic/math/Arithmetic';
import '../HandlerFunction';
import {convertToObject, DataMap} from '../../util/DataTypes';
import {CompleteEvent, ErrorEvent, Event, WAIT} from '../../block/Event';
import {shouldHappen, shouldTimeout} from '../../util/test-util';
import {Task} from '../../block/Task';

const handlerWorker = {
  '#is': {
    '#is': '',
    'add': {'#is': 'add', '~0': '##.#input.n', '1': 1},
    '#input': {'#is': '', '#more': [{name: 'n', type: 'number'}]},
    '#output': {'#is': '', '~#value': '##.add.output'}
  }
};

const waitWorker = {
  '#is': {
    '#is': '',
    '#output': {'#is': '', '#wait': true}
  }
};

class TestTask extends Task {
  static logs: any[] = [];
  static popLogs(): any[] {
    let result = TestTask.logs;
    TestTask.logs = [];
    return result;
  }
  static clearLog() {
    TestTask.logs.length = 0;
  }

  n: number;
  constructor(n: number) {
    super();
    this.n = n;
  }
  getDataMap(): any {
    return {n: this.n};
  }

  onComplete(worker: Job, output: any): DataMap {
    let result = convertToObject(output);
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

describe('TaskHandlerFunction', function() {
  it('basic', function() {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock._load({
      '#is': 'handler',
      'use': handlerWorker
    });

    aBlock.setValue('#call', new TestTask(1));

    Root.runAll(2);

    assert.deepEqual(TestTask.popLogs(), [2]);

    // delete handler;
    job.deleteValue('a');
  });

  it('timeout', async function() {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock._load({
      '#is': 'handler',
      'timeout': 0.01,
      'use': waitWorker
    });

    aBlock.setValue('#call', new TestTask(1));

    Root.run();
    await shouldHappen(() => TestTask.logs.length);
    assert.deepEqual(TestTask.popLogs(), ['timeout']);

    // delete handler;
    job.deleteValue('a');
  });

  it('cancel', async function() {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock._load({
      '#is': 'handler',
      'use': waitWorker
    });

    aBlock.setValue('#call', new TestTask(1));

    Root.run();
    aBlock.setValue('#cancel', {});

    assert.deepEqual(TestTask.popLogs(), ['cancel']);

    // delete handler;
    job.deleteValue('a');
  });
});
