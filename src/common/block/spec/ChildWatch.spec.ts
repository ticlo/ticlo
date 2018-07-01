import { assert } from "chai";
import { Block } from "../Block";

import { Job } from "../Job";
import { BlockIO } from "../BlockProperty";

describe("Block Child Watch", () => {
  it('basic', () => {
    let job = new Job();

    let watchLog: any[] = [];
    let watch = {
      onChildChange(property: BlockIO, block: Block, temp: boolean) {
        watchLog.push([property._name, block != null, Boolean(temp)]);
      }
    };
    job.watch(watch);

    job.createBlock('a');
    assert.deepEqual(watchLog, [['a', true, false]], 'new block');
    watchLog = [];

    job.createTempJob('a');
    assert.deepEqual(watchLog, [['a', false, false], ['a', true, true]], 'replace with temp block');
    watchLog = [];

    job.createBlock('a');
    assert.deepEqual(watchLog, [['a', false, true], ['a', true, false]], 'replace with normal block');
    watchLog = [];

    job.setValue('a', null);
    assert.deepEqual(watchLog, [['a', false, false]], 'remove block');
    watchLog = [];

    job.createTempJob('a');
    assert.deepEqual(watchLog, [['a', true, true]], 'new temp block');
    watchLog = [];

    job.setBinding('a', 'b');
    assert.deepEqual(watchLog, [['a', false, true]], 'remove block with binding');
    watchLog = [];
  });
});
