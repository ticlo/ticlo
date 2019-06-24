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
      '#is': 'add',
      '#more': [
        {name: 'aa', type: 'number'},
        {name: 'bb', type: 'string'}
      ]
    });

    showProperties(job, ['#call', '1', 'bb']);
    assert.deepEqual(job.getValue('@b-p'), ['#call', '1', 'bb']);

    showProperties(job, ['1', '@a', 'aa', '#is', '5', '0']);
    assert.deepEqual(job.getValue('@b-p'), ['#is', '#call', '0', '1', 'aa', 'bb', '@a', '5']);

    hideProperties(job, ['aa', '1', '@a', '@b']);
    assert.deepEqual(job.getValue('@b-p'), ['#is', '#call', '0', 'bb', '5']);
  });
});
