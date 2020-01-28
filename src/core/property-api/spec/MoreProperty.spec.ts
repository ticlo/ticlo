import {assert} from 'chai';

import {addCustomProperty, moveCustomProperty, removeCustomProperty} from '../CustomProperty';
import {Job} from '../../block/Block';
import {PropDesc, PropGroupDesc} from '../../block/Descriptor';

describe('Custom Property', function() {
  let descA: PropDesc = {name: 'a', type: 'string'};
  let descB: PropDesc = {name: 'b', type: 'number'};
  let descBNumber: PropDesc = {name: 'b0', type: 'number'};
  let descA2: PropDesc = {name: 'a', type: 'number', visible: 'low'};
  let descC: PropDesc = {name: 'c', type: 'toggle'};
  let descBlank: PropDesc = {name: '', type: 'string'};
  let descG: PropGroupDesc = {
    name: 'g',
    type: 'group',
    defaultLen: 1,
    properties: []
  };
  let descG2: PropGroupDesc = {name: 'g', type: 'group'} as PropGroupDesc; // automatically fix group desc
  let descG2Fix: PropGroupDesc = {
    name: 'g',
    type: 'group',
    defaultLen: 2,
    properties: []
  };

  it('add remove CustomProperty', function() {
    let job = new Job();

    // remove should do nothing when #custom is undefined
    removeCustomProperty(job, 'a');
    assert.isUndefined(job.getValue('#custom'));

    // add invalid desc
    addCustomProperty(job, {} as any);
    assert.isUndefined(job.getValue('#custom'));

    // add invalid desc
    addCustomProperty(job, {...descBlank, visible: 'low'});
    assert.isUndefined(job.getValue('#custom'));

    // add property into group that doesn't exist
    addCustomProperty(job, descA, 'g');
    assert.isUndefined(job.getValue('#custom'));

    addCustomProperty(job, descA);
    assert.deepEqual(job.getValue('#custom'), [descA]);
    assert.deepEqual(job.getValue('@b-p'), ['a']);

    addCustomProperty(job, descB);
    assert.deepEqual(job.getValue('#custom'), [descA, descB]);
    assert.deepEqual(job.getValue('@b-p'), ['a', 'b']);

    // when prop name is same, overwrite the previous one
    addCustomProperty(job, descA2);
    assert.deepEqual(job.getValue('#custom'), [descA2, descB]);

    // add property into group that doesn't exist
    addCustomProperty(job, descA, 'g');
    assert.deepEqual(job.getValue('#custom'), [descA2, descB]);

    addCustomProperty(job, descG);
    assert.deepEqual(job.getValue('#custom'), [descA2, descB, descG]);
    assert.deepEqual(job.getValue('@b-p'), ['a', 'b']);

    // add property into group
    addCustomProperty(job, descA2, 'g');
    assert.deepEqual(job.getValue('#custom'), [descA2, descB, {...descG, properties: [descA2]}]);
    assert.deepEqual(job.getValue('@b-p'), ['a', 'b']);

    // cant add property name ends with number into a group
    addCustomProperty(job, descBNumber, 'g');
    assert.deepEqual(job.getValue('#custom'), [descA2, descB, {...descG, properties: [descA2]}]);

    // add property with blank name into group
    addCustomProperty(job, descBlank, 'g');
    assert.deepEqual(job.getValue('#custom'), [descA2, descB, {...descG, properties: [descA2, descBlank]}]);
    assert.deepEqual(job.getValue('@b-p'), ['a', 'b', '0']);

    // replace property in group
    addCustomProperty(job, descA, 'g');
    assert.deepEqual(job.getValue('#custom'), [descA2, descB, {...descG, properties: [descA, descBlank]}]);

    // replace the group
    addCustomProperty(job, descG2);
    assert.deepEqual(job.getValue('#custom'), [descA2, descB, descG2Fix]);
    assert.deepEqual(job.getValue('@b-p'), ['a', 'b']);

    addCustomProperty(job, descA, 'g');
    assert.deepEqual(job.getValue('#custom'), [descA2, descB, {...descG2Fix, properties: [descA]}]);
    assert.deepEqual(job.getValue('@b-p'), ['a', 'b', 'a0', 'a1']);

    // remove property from group
    removeCustomProperty(job, 'a', 'g');
    assert.deepEqual(job.getValue('#custom'), [descA2, descB, descG2Fix]);
    assert.deepEqual(job.getValue('@b-p'), ['a', 'b']);
    // again
    removeCustomProperty(job, 'a', 'g');
    assert.deepEqual(job.getValue('#custom'), [descA2, descB, descG2Fix]);

    removeCustomProperty(job, 'a');
    assert.deepEqual(job.getValue('#custom'), [descB, descG2Fix]);
    assert.deepEqual(job.getValue('@b-p'), ['b']);
    // again
    removeCustomProperty(job, 'a');
    assert.deepEqual(job.getValue('#custom'), [descB, descG2Fix]);

    // remove the group
    removeCustomProperty(job, null, 'g');
    assert.deepEqual(job.getValue('#custom'), [descB]);
    // again
    removeCustomProperty(job, null, 'g');
    assert.deepEqual(job.getValue('#custom'), [descB]);

    // remove nothing
    removeCustomProperty(job, null, null);
    assert.deepEqual(job.getValue('#custom'), [descB]);
  });

  it('move CustomProperty', function() {
    let job = new Job();

    moveCustomProperty(job, 'a', 'b');
    assert.isUndefined(job.getValue('#custom'));

    moveCustomProperty(job, 'a', 'a');
    assert.isUndefined(job.getValue('#custom'));

    job.setValue('#custom', [
      descA,
      {
        ...descG,
        properties: [descA, descC]
      },
      descB
    ]);

    moveCustomProperty(job, 'a', 'b');
    assert.deepEqual(job.getValue('#custom'), [{...descG, properties: [descA, descC]}, descB, descA]);

    moveCustomProperty(job, 'a', 'b');
    assert.deepEqual(job.getValue('#custom'), [{...descG, properties: [descA, descC]}, descA, descB]);

    moveCustomProperty(job, 'a', 'g');
    assert.deepEqual(job.getValue('#custom'), [descA, {...descG, properties: [descA, descC]}, descB]);

    moveCustomProperty(job, 'a', 'c', 'g');
    assert.deepEqual(job.getValue('#custom'), [descA, {...descG, properties: [descC, descA]}, descB]);

    moveCustomProperty(job, 'a', 'c', 'g2'); // group doesn't exist
    assert.deepEqual(job.getValue('#custom'), [descA, {...descG, properties: [descC, descA]}, descB]);

    moveCustomProperty(job, 'a', 'c'); // property doesn't exist
    assert.deepEqual(job.getValue('#custom'), [descA, {...descG, properties: [descC, descA]}, descB]);

    moveCustomProperty(job, 'c', 'b'); // property doesn't exist
    assert.deepEqual(job.getValue('#custom'), [descA, {...descG, properties: [descC, descA]}, descB]);
  });
});
