import {assert} from 'chai';
import '../CreateObject';
import {Job, Root, Block} from '../../../block/Block';

describe('CreateObject', function() {
  it('basic', function() {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'create-object',
      'v': 12,
      '#custom': [
        {name: 'v', type: 'number'},
        {name: 'u', type: 'string'}
      ]
    });

    Root.run();

    assert.deepEqual(aBlock.getValue('#output'), {v: 12});
  });

  it('spread', function() {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'create-object',
      '#extend': {v: 0, t: 1},
      'v': 13,
      '#custom': [{name: 'v', type: 'number'}]
    });

    Root.run();

    assert.deepEqual(aBlock.getValue('#output'), {v: 13, t: 1});
  });

  it('array', function() {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'create-object',
      'g#len': 3,
      'v0': 1,
      'v1': 2,
      '#custom': [{name: 'g', type: 'group', defaultLen: 2, properties: [{name: 'v', type: 'number'}]}]
    });

    Root.run();

    assert.deepEqual(aBlock.getValue('#output'), {v: [1, 2, undefined]});
  });
});
