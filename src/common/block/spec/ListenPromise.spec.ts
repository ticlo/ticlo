import {assert, AssertionError} from "chai";
import {Job} from "../Job";
import {ErrorEvent} from "../Event";
import {shouldReject} from "./TestFunction";

describe("ListenPromise", () => {

  it('basic', async () => {
    let job = new Job();

    setTimeout(() => job.setValue('a', 1), 0);
    assert.equal(await job.waitValue('a'), 1);

    {
      let timer;
      let count = 0;
      timer = setInterval(() => job.setValue('b', ++count), 1);
      let result = await job.waitValue('b', (val) => val > 5);
      assert.equal(result, 6, 'listen promise with validator');
      clearInterval(timer);
    }

    setTimeout(() => job.setValue('c', new ErrorEvent('')), 0);
    assert.instanceOf(await shouldReject(job.waitValue('c')), ErrorEvent,
      'waitValue should be rejected on ErrorEvent');
  });

  it('destroyed dispatcher', async () => {
    let job = new Job();
    let block = job.createBlock('a');

    setTimeout(() => job.deleteValue('a'), 0);
    assert.instanceOf(await shouldReject(block.waitValue('v')), ErrorEvent,
      'waitValue should be rejected when parent is destroyed');
  });


});
