import { assert } from "chai";
import { Block } from "../Block";

import { Job } from "../Job";
import { BlockIO } from "../BlockProperty";

describe("Block Child Watch", () => {
  it('basic', () => {
    let job = new Job();

    let watchLog: any[] = [];
    let watch = {
      onChildChange(property: BlockIO, block: Block) {
        watchLog.push([property._name, block != null]);
      }
    };
    job.watch(watch);

    job.createBlock('a');
    assert.deepEqual(watchLog, [['a', true]], 'new block');
    watchLog = [];

    job.createTempBlock('a');
    assert.deepEqual(watchLog, [['a', false]], 'replace with temp block');
    watchLog = [];

    job.createBlock('a');
    assert.deepEqual(watchLog, [['a', true]], 'replace with normal block');
    watchLog = [];

    job.setValue('a', null);
    assert.deepEqual(watchLog, [['a', false]], 'remove block');
    watchLog = [];

    job.createBlock('a');
    watchLog = [];

    job.setBinding('a', 'b');
    assert.deepEqual(watchLog, [['a', false]], 'remove block with binding');
    watchLog = [];
  });
});
