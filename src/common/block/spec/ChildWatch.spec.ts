import {assert} from "chai";
import {Job} from "../Block";
import {BlockIO} from "../BlockProperty";

describe("Block Child Watch", () => {
  it('basic', () => {
    let job = new Job();

    let watchLog: any[] = [];
    let watch = {
      onChildChange(property: BlockIO, saved: boolean) {
        watchLog.push([property._name, property._value != null, Boolean(saved)]);
      }
    };
    job.watch(watch);

    job.createBlock('a');
    assert.deepEqual(watchLog, [['a', true, true]], 'new block');
    watchLog = [];

    job.createOutputBlock('a');
    assert.deepEqual(watchLog, [['a', true, false]], 'replace with temp block');
    watchLog = [];

    job.createBlock('a');
    assert.deepEqual(watchLog, [['a', true, true]], 'replace with normal block');
    watchLog = [];

    job.setValue('a', null);
    assert.deepEqual(watchLog, [['a', false, true]], 'remove block');
    watchLog = [];

    job.createOutputBlock('a');
    assert.deepEqual(watchLog, [['a', true, false]], 'new temp block');
    watchLog = [];

    job.setBinding('a', 'b');
    assert.deepEqual(watchLog, [['a', false, false]], 'remove block with binding');
    watchLog = [];
  });
});
