import {assert} from 'chai';

import {addCustomProperty, moveCustomProperty, removeCustomProperty} from '../CustomProperty';
import {Flow} from '../../block/Flow';
import {PropDesc, PropGroupDesc} from '../../block/Descriptor';

describe('Custom Property', function () {
  let descA: PropDesc = {name: 'a', type: 'string', pinned: true};
  let descB: PropDesc = {name: 'b', type: 'number', pinned: true};
  let descBNumber: PropDesc = {name: 'b0', type: 'number', pinned: true};
  let descA2: PropDesc = {name: 'a', type: 'number'};
  let descC: PropDesc = {name: 'c', type: 'toggle', pinned: true};
  let descBlank: PropDesc = {name: '', type: 'string', pinned: true};
  let descG: PropGroupDesc = {
    name: 'g',
    type: 'group',
    defaultLen: 1,
    properties: [],
  };
  let descG2: PropGroupDesc = {name: 'g', type: 'group'} as PropGroupDesc; // automatically fix group desc
  let descG2Fix: PropGroupDesc = {
    name: 'g',
    type: 'group',
    defaultLen: 2,
    properties: [],
  };

  it('add remove CustomProperty', function () {
    let flow = new Flow();

    // remove should do nothing when #custom is undefined
    removeCustomProperty(flow, 'a');
    assert.isUndefined(flow.getValue('#custom'));

    // add invalid desc
    addCustomProperty(flow, {} as any);
    assert.isUndefined(flow.getValue('#custom'));

    // add invalid desc
    addCustomProperty(flow, {...descBlank});
    assert.isUndefined(flow.getValue('#custom'));

    // add property into group that doesn't exist
    addCustomProperty(flow, descA, 'g');
    assert.isUndefined(flow.getValue('#custom'));

    addCustomProperty(flow, descA);
    assert.deepEqual(flow.getValue('#custom'), [descA]);
    assert.deepEqual(flow.getValue('@b-p'), ['a']);

    addCustomProperty(flow, descB);
    assert.deepEqual(flow.getValue('#custom'), [descA, descB]);
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'b']);

    // when prop name is same, overwrite the previous one
    addCustomProperty(flow, descA2);
    assert.deepEqual(flow.getValue('#custom'), [descA2, descB]);

    // add property into group that doesn't exist
    addCustomProperty(flow, descA, 'g');
    assert.deepEqual(flow.getValue('#custom'), [descA2, descB]);

    addCustomProperty(flow, descG);
    assert.deepEqual(flow.getValue('#custom'), [descA2, descB, descG]);
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'b']);

    // add property into group
    addCustomProperty(flow, descA2, 'g');
    assert.deepEqual(flow.getValue('#custom'), [descA2, descB, {...descG, properties: [descA2]}]);
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'b']);

    // cant add property name ends with number into a group
    addCustomProperty(flow, descBNumber, 'g');
    assert.deepEqual(flow.getValue('#custom'), [descA2, descB, {...descG, properties: [descA2]}]);

    // add property with blank name into group
    addCustomProperty(flow, descBlank, 'g');
    assert.deepEqual(flow.getValue('#custom'), [descA2, descB, {...descG, properties: [descA2, descBlank]}]);
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'b', '0']);

    // replace property in group
    addCustomProperty(flow, descA, 'g');
    assert.deepEqual(flow.getValue('#custom'), [descA2, descB, {...descG, properties: [descA, descBlank]}]);

    // replace the group
    addCustomProperty(flow, descG2);
    assert.deepEqual(flow.getValue('#custom'), [descA2, descB, descG2Fix]);
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'b']);

    addCustomProperty(flow, descA, 'g');
    assert.deepEqual(flow.getValue('#custom'), [descA2, descB, {...descG2Fix, properties: [descA]}]);
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'b', 'a0', 'a1']);

    // remove property from group
    flow.setValue('a0', 1);
    removeCustomProperty(flow, 'a', 'g');
    assert.deepEqual(flow.getValue('#custom'), [descA2, descB, descG2Fix]);
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'b']);
    assert.isUndefined(flow.getValue('a0'));
    // again
    removeCustomProperty(flow, 'a', 'g');
    assert.deepEqual(flow.getValue('#custom'), [descA2, descB, descG2Fix]);

    flow.setValue('a', 1);
    removeCustomProperty(flow, 'a');
    assert.deepEqual(flow.getValue('#custom'), [descB, descG2Fix]);
    assert.deepEqual(flow.getValue('@b-p'), ['b']);
    assert.isUndefined(flow.getValue('a'));
    // again
    removeCustomProperty(flow, 'a');
    assert.deepEqual(flow.getValue('#custom'), [descB, descG2Fix]);

    // remove the group
    removeCustomProperty(flow, null, 'g');
    assert.deepEqual(flow.getValue('#custom'), [descB]);
    // again
    removeCustomProperty(flow, null, 'g');
    assert.deepEqual(flow.getValue('#custom'), [descB]);

    // remove nothing
    removeCustomProperty(flow, null, null);
    assert.deepEqual(flow.getValue('#custom'), [descB]);

    // cleared
    removeCustomProperty(flow, 'b');
    assert.isUndefined(flow.getValue('#custom'));
  });

  it('move CustomProperty', function () {
    let flow = new Flow();

    moveCustomProperty(flow, 'a', 'b');
    assert.isUndefined(flow.getValue('#custom'));

    moveCustomProperty(flow, 'a', 'a');
    assert.isUndefined(flow.getValue('#custom'));

    flow.setValue('#custom', [
      descA,
      {
        ...descG,
        properties: [descA, descC],
      },
      descB,
    ]);

    moveCustomProperty(flow, 'a', 'b');
    assert.deepEqual(flow.getValue('#custom'), [{...descG, properties: [descA, descC]}, descB, descA]);

    moveCustomProperty(flow, 'a', 'b');
    assert.deepEqual(flow.getValue('#custom'), [{...descG, properties: [descA, descC]}, descA, descB]);

    moveCustomProperty(flow, 'a', 'g');
    assert.deepEqual(flow.getValue('#custom'), [descA, {...descG, properties: [descA, descC]}, descB]);

    moveCustomProperty(flow, 'a', 'c', 'g');
    assert.deepEqual(flow.getValue('#custom'), [descA, {...descG, properties: [descC, descA]}, descB]);

    moveCustomProperty(flow, 'a', 'c', 'g2'); // group doesn't exist
    assert.deepEqual(flow.getValue('#custom'), [descA, {...descG, properties: [descC, descA]}, descB]);

    moveCustomProperty(flow, 'a', 'c'); // property doesn't exist
    assert.deepEqual(flow.getValue('#custom'), [descA, {...descG, properties: [descC, descA]}, descB]);

    moveCustomProperty(flow, 'c', 'b'); // property doesn't exist
    assert.deepEqual(flow.getValue('#custom'), [descA, {...descG, properties: [descC, descA]}, descB]);
  });
});
