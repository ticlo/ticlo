import {assert} from 'chai';

import {Block} from '../../block/Block';
import {Job} from '../../block/Job';
import '../../functions/basic/math/Arithmetic';
import {insertGroupProperty, moveGroupProperty, removeGroupProperty, setGroupLength} from '../GroupProperty';

describe('GroupProperty', function () {
  it('setGroupLength', function () {
    let job = new Job();
    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'add',
    });

    setGroupLength(aBlock, '', 3);
    assert.deepEqual(aBlock.getValue('[]'), 3);
    assert.deepEqual(aBlock.getValue('@b-p'), ['2']);

    setGroupLength(aBlock, '', 0);
    assert.isUndefined(aBlock.getValue('@b-p'));

    setGroupLength(aBlock, '', 3);
    assert.deepEqual(aBlock.getValue('@b-p'), ['0', '1', '2']);

    // set -1 will use default length
    setGroupLength(aBlock, '', -1);
    assert.deepEqual(aBlock.getValue('@b-p'), ['0', '1']);

    // invalid group, length should change but nothing else should happen
    setGroupLength(aBlock, 'invalidG', 3);
    assert.deepEqual(aBlock.getValue('invalidG[]'), 3);
    assert.deepEqual(aBlock.getValue('@b-p'), ['0', '1']);
  });

  it('setGroupLength on #custom', function () {
    let job = new Job();
    job.load({
      '#is': '',
      '#custom': [
        {
          name: 'g',
          type: 'group',
          defaultLen: 2,
          properties: [{name: 'a', type: 'number'}],
        },
      ],
    });

    setGroupLength(job, 'g', 3);
    assert.deepEqual(job.getValue('g[]'), 3);
    assert.deepEqual(job.getValue('@b-p'), ['a2']);
  });

  it('insertGroupProperty', function () {
    let job = new Job();
    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'add',
      '0': 0,
      '1': 1,
    });

    insertGroupProperty(aBlock, '', 0);
    assert.equal(aBlock.getValue('[]'), 3);
    assert.equal(aBlock.getValue('1'), 0);

    insertGroupProperty(aBlock, '', 3);
    assert.equal(aBlock.getValue('[]'), 4);

    // invalid index, no change
    insertGroupProperty(aBlock, '', -1);
    insertGroupProperty(aBlock, '', 100);
    assert.equal(aBlock.getValue('[]'), 4);

    // invalid group, no change
    insertGroupProperty(aBlock, 'invalidG', 0);
    assert.isUndefined(aBlock.getValue('invalidG[]'));
  });

  it('removeGroupProperty', function () {
    let job = new Job();
    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'add',
      '0': 0,
      '1': 1,
    });

    removeGroupProperty(aBlock, '', 0);
    assert.equal(aBlock.getValue('[]'), 1);
    assert.equal(aBlock.getValue('0'), 1);

    // invalid index, no change
    removeGroupProperty(aBlock, '', -1);
    removeGroupProperty(aBlock, '', 100);
    assert.equal(aBlock.getValue('[]'), 1);

    // invalid group, no change
    removeGroupProperty(aBlock, 'invalidG', 0);
    assert.isUndefined(aBlock.getValue('invalidG[]'));
  });

  it('moveGroupProperty', function () {
    let job = new Job();
    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'add',
      '0': 0,
      '1': 1,
    });

    moveGroupProperty(aBlock, '', 0, 1);
    assert.equal(aBlock.getValue('0'), 1);
    assert.equal(aBlock.getValue('1'), 0);

    moveGroupProperty(aBlock, '', 1, 0);
    assert.equal(aBlock.getValue('0'), 0);
    assert.equal(aBlock.getValue('1'), 1);

    // invalid index, no change
    moveGroupProperty(aBlock, '', 1, 100);
    moveGroupProperty(aBlock, '', 100, 0);
    moveGroupProperty(aBlock, '', 0, 0);
    assert.equal(aBlock.getValue('0'), 0);
    assert.equal(aBlock.getValue('1'), 1);

    // invalid group, no change
    moveGroupProperty(aBlock, 'invalidG', 0, 1);
    assert.isUndefined(aBlock.getValue('invalidG[]'));
  });
});
