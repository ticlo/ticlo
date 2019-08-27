import {assert} from "chai";
import {Job, Root} from "../../block/Block";
import {JobEditor} from "../JobEditor";
import {VoidListeners} from "../../block/spec/TestFunction";

describe("JobEditor", function () {

  it('delete editor after unwatch', function () {
    let job = new Job();
    let editor1 = JobEditor.create(job, '#edit-1', {});
    let editor2 = JobEditor.create(job, '#edit-2');
    editor1.watch(VoidListeners);
    assert.equal(job.getValue('#edit-1'), editor1);
    assert.equal(job.getValue('#edit-2'), editor2);

    // value deleted after unwatch
    editor1.unwatch(VoidListeners);
    assert.isUndefined(job.getValue('#edit-1'));
  });
});
