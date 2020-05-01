import {assert} from 'chai';
import {Flow, Root} from '../Flow';
import {Event} from '../Event';
import {TestFunctionRunner} from './TestFunction';

describe('Event', function () {
  it('Event Uid Change in Root', function () {
    let uid = Event.uid;
    assert.equal(uid, Event.uid);
    Root.run();
    assert.notEqual(uid, Event.uid);
  });

  it('event life cycle', function () {
    TestFunctionRunner.clearLog();

    let job = new Flow();

    let block = job.createBlock('obj');
    block.setValue('#-log', 'obj');
    block.setValue('#is', 'test-runner');

    let event = new Event('');
    block.setValue('#call', event);
    Root.run();
    assert.deepEqual(TestFunctionRunner.popLogs(), ['obj']);

    block.setValue('#call', new Event(''));
    Root.run();
    assert.deepEqual(TestFunctionRunner.popLogs(), ['obj']);

    block.setValue('#call', event);
    Root.run();
    assert.deepEqual(TestFunctionRunner.popLogs(), [], 'old event should not trigger event');
  });
});
