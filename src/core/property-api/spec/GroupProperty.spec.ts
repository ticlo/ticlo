import {assert} from "chai";

import {Block, Job} from "../../block/Block";
import "../../functions/basic/Math";
import {setGroupLength} from "../GroupProperty";

describe("PropertyUtil", function () {

  it('set group length', function () {
    let job = new Job();
    job.load({
      '#is': 'add'
    });

    setGroupLength(job, '', 3);
    assert.deepEqual(job.getValue('#len'), 3);
    assert.deepEqual(job.getValue('@b-p'), ['2']);

    setGroupLength(job, '', 0);
    assert.isUndefined(job.getValue('@b-p'));

    setGroupLength(job, '', 3);
    assert.deepEqual(job.getValue('@b-p'), ['0', '1', '2']);
  });
});
