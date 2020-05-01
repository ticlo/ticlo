import {assert} from 'chai';
import '../CreateObject';
import {Block} from '../../../block/Block';
import {Flow, Root} from '../../../block/Flow';

describe('CreateObject', function () {
  it('basic', function () {
    let job = new Flow();

    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'create-object',
      'v': 12,
      '#custom': [
        {name: 'v', type: 'number'},
        {name: 'u', type: 'string'},
      ],
    });

    Root.run();

    assert.deepEqual(aBlock.getValue('#output'), {v: 12});
  });

  it('extend', function () {
    let job = new Flow();

    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'create-object',
      '#extend': {v: 0, t: 1},
      'v': 13,
      'u': 14,
      '#custom': [{name: 'v', type: 'number'}],
    });

    Root.run();
    assert.deepEqual(aBlock.getValue('#output'), {v: 13, t: 1});

    aBlock.setValue('#custom', [{name: 'u', type: 'number'}]);
    Root.run();
    assert.deepEqual(aBlock.getValue('#output'), {v: 0, t: 1, u: 14});
  });

  it('array', function () {
    let job = new Flow();

    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'create-object',
      'v[]': 3,
      'v0': 1,
      'v1': 2,
      'a0': 3,
      '#custom': [
        {name: 'v', type: 'group', defaultLen: 2, properties: [{name: 'v', type: 'number'}]},
        {
          name: 'g',
          type: 'group',
          defaultLen: 1,
          properties: [
            {name: 'a', type: 'number'},
            {name: 'b', type: 'number'},
          ],
        },
      ],
    });

    Root.run();

    assert.deepEqual(aBlock.getValue('#output'), {v: [1, 2, undefined], g: [{a: 3, b: undefined}]});
  });
});
