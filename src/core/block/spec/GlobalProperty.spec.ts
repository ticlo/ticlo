import {assert} from "chai";
import {Job, Root, Block} from "../Block";
import {DataMap} from "../../util/Types";
import {WorkerFunction} from "../../worker/WorkerFunction";

describe("GlobalProperty", function () {

  it('global from nested job', function () {

    let globalBlock: Block = Root.instance.getValue('#global');
    assert.instanceOf(globalBlock, Block);

    let job = new Job();
    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', 'GlobalProperty:class1');

    let jobData: DataMap = {
      '#is': '',
      '~v': '^top.v',
    };
    WorkerFunction.registerType(jobData, {name: 'class1'}, 'GlobalProperty');

    Root.run();

    let impl: Job = aBlock.getValue('#func') as Job;
    assert.instanceOf(impl, Job, 'get #func of nested job');
    // v not ready yet
    assert.isUndefined(impl.getValue('v'));

    let top = globalBlock.createBlock('^top');
    top.setValue('v', 123);
    assert.equal(impl.getValue('v'), 123);

    // overwrite the global block in the local job
    let topOverwrite = job.createBlock('^top');
    assert.isUndefined(impl.getValue('v'));

    topOverwrite.setValue('v', 456);
    assert.equal(impl.getValue('v'), 456);

    // clear the overwrite, restore the global link
    job.deleteValue('^top');
    assert.equal(impl.getValue('v'), 123);

    // global property is in use
    assert.isTrue(job._props.has('^top'));

    // global property is no longer in use
    job.deleteValue('a');
    assert.isFalse(job._props.has('^top'));

  });

});
