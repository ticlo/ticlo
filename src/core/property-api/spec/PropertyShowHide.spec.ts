import {assert} from 'chai';

import {Job, PropDesc, PropGroupDesc} from '../..';
import {showProperties, hideProperties, moveShownProperty, hideGroupProperties} from '../PropertyShowHide';

describe('PropertyOrder', function() {
  it('show hide Property', function() {
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

  it('show hide Properties with order', function() {
    let job = new Job();
    job.load({
      '#is': 'add',
      '#custom': [
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

  it('hideGroupProperties', function() {
    let descG: PropGroupDesc = {
      name: 'g',
      type: 'group',
      defaultLen: 2,
      properties: [{name: 'a', type: 'string'}]
    };

    let job = new Job();

    hideGroupProperties(job, descG);
    hideGroupProperties(job, descG, 'a');
    assert.isUndefined(job.getValue('@b-p'));

    job.load({
      '#is': 'add',
      '@b-p': ['a', 'a1', 'b', 'a02', 'b0']
    });

    hideGroupProperties(job, descG, 'b');
    assert.deepEqual(job.getValue('@b-p'), ['a', 'a1', 'b', 'a02']);

    hideGroupProperties(job, descG);
    assert.deepEqual(job.getValue('@b-p'), ['a', 'b']);
  });

  it('moveShownProperty', function() {
    let job = new Job();

    moveShownProperty(job, 'a', 'b');
    assert.isUndefined(job.getValue('@b-p'));

    showProperties(job, ['a', 'b', 'c']);
    assert.deepEqual(job.getValue('@b-p'), ['a', 'b', 'c']);

    moveShownProperty(job, 'a', 'b');
    assert.deepEqual(job.getValue('@b-p'), ['b', 'a', 'c']);

    moveShownProperty(job, 'a', 'b');
    assert.deepEqual(job.getValue('@b-p'), ['a', 'b', 'c']);

    moveShownProperty(job, 'a', 'a');
    assert.deepEqual(job.getValue('@b-p'), ['a', 'b', 'c']);
  });
});
