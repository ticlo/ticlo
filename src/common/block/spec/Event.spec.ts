import {assert} from "chai";
import {Job, Root} from "../Block";
import {Event} from "../Event";
import {TestFunctionRunner} from "./TestFunction";

describe("Event", () => {

  it('Event Uid Change in Root', () => {
    let uid = Event.uid;
    assert.equal(uid, Event.uid);
    Root.run();
    assert.notEqual(uid, Event.uid);
  });

  it('event life cycle', () => {
    TestFunctionRunner.clearLog();

    let job = new Job();

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
