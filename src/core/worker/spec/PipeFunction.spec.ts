import {assert} from 'chai';
import {Job, Root} from '../../block/Block';
import {TestFunctionRunner, TestAsyncFunctionPromise} from '../../block/spec/TestFunction';
import '../../functions/basic/math/Arithmetic';
import '../PipeFunction';
import {DataMap} from '../../util/DataTypes';
import {CompleteEvent, ErrorEvent, NOT_READY} from '../../block/Event';
import {shouldTimeout} from '../../util/test-util';

class PipeListener {
  emits: any[] = [];
  onChange(val: any) {
    if (val && val.constructor !== CompleteEvent) {
      this.emits.push(val);
    }
  }
  onSourceChange(prop: any): void {}
}

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
      'use': {
        '#is': {
          '#is': '',
          'add': {'#is': 'add', '~0': '##.#input', '1': 1},
          '#output': {'#is': '', '~#value': '##.add.output'}
        }
      }
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
      'use': {
        '#is': {
          '#is': '',
          'runner': {'#is': 'test-runner', '#mode': 'onLoad', '#-log': 0},
          'add': {'#is': 'add', '~0': '##.#input', '1': 1},
          '#output': {'#is': '', '~#value': '##.add.output'}
        }
      }
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
});
