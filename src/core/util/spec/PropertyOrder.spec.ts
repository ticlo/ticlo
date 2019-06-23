import {assert} from "chai";

import {showProperties, hideProperties} from "../PropertyOrder";
import {Job} from "../../block/Block";

describe("PropertyOrder", function () {

  it('show hide Property', function () {
    let job = new Job();
    job.load({
      '#is': 'add'
    });
    hideProperties(job, ['@a']);
    assert.isUndefined(job.getValue('@b-p'));

    showProperties(job, ['@a']);
    assert.deepEqual(job.getValue('@b-p'), ['@a']);

    showProperties(job, ['@a']);
    assert.deepEqual(job.getValue('@b-p'), ['@a']);

    hideProperties(job, ['@b']); // remove a property not in the list
    assert.deepEqual(job.getValue('@b-p'), ['@a']); // no change

    hideProperties(job, ['@a']);
    assert.isUndefined(job.getValue('@b-p'));
  });

  it('show hide Properties with order', function () {
    let job = new Job();
    job.load({
      '#is': 'add'
    });

    showProperties(job, ['#call', '1']);
    assert.deepEqual(job.getValue('@b-p'), ['#call', '1']);

    showProperties(job, ['1', '@a', '#is', '5', '0']);
    assert.deepEqual(job.getValue('@b-p'), ['#is', '#call', '0', '1', '@a', '5']);

    hideProperties(job, ['1', '@a', '@b']);
    assert.deepEqual(job.getValue('@b-p'), ['#is', '#call', '0', '5']);
  });
});
