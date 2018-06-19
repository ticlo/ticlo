import { assert } from "chai";
import { Block } from "../Block";

import { Job } from "../Job";
import { Dispatcher } from "../Dispatcher";

describe("Destroyed Block", () => {

  it('throw on destroyed block', () => {
    let job = new Job();

    let block = job.createBlock('a');
    let propB = job.getProperty('b');

    job.setValue('a', null);

    assert(block._destroyed, 'block should be destroyed');

    assert.throw(() => block.getProperty('a'));
    assert.throw(() => block.setValue('a', 1));
    assert.throw(() => block.updateValue('a', 1));
    assert.throw(() => block.setBinding('a', 'b'));
    assert.throw(() => block.output(1));
    assert.throw(() => block.createBinding('##', propB));

    block.destroy(); // destroy twice should be safe
  });

});
