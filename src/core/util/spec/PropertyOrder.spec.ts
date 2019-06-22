import {assert} from "chai";

import {showProperties, hideProperties} from "../PropertyOrder";
import {Job} from "../../block/Block";

describe("PropertyOrder", function () {

  it('show hide Properties', function () {
    let job = new Job();
    job.load({
      '#is': 'add'
    });
    hideProperties(job, ['1']);
    assert.isUndefined(job.getValue('@b-p'));

    showProperties(job, ['#call', '1']);
    assert.deepEqual(job.getValue('@b-p'), ['#call', '1']);

    showProperties(job, ['@a', '#is', '5', '0']);
    assert.deepEqual(job.getValue('@b-p'), ['#is', '#call', '0', '1', '@a', '5']);

    hideProperties(job, ['1']);
    assert.deepEqual(job.getValue('@b-p'), ['#is', '#call', '0', '@a', '5']);
  });
});
