import {expect} from 'vitest';

import {addCustomProperty, moveCustomProperty, removeCustomProperty} from '../CustomProperty.js';
import {Flow} from '../../block/Flow.js';
import {PropDesc, PropGroupDesc} from '../../block/Descriptor.js';

describe('Custom Property', function () {
  const descA: PropDesc = {name: 'a', type: 'string', pinned: true};
  const descB: PropDesc = {name: 'b', type: 'number', pinned: true};
  const descBNumber: PropDesc = {name: 'b0', type: 'number', pinned: true};
  const descA2: PropDesc = {name: 'a', type: 'number'};
  const descC: PropDesc = {name: 'c', type: 'toggle', pinned: true};
  const descBlank: PropDesc = {name: '', type: 'string', pinned: true};
  const descG: PropGroupDesc = {
    name: 'g',
    type: 'group',
    defaultLen: 1,
    properties: [],
  };
  const descG2: PropGroupDesc = {name: 'g', type: 'group'} as PropGroupDesc; // automatically fix group desc
  const descG2Fix: PropGroupDesc = {
    name: 'g',
    type: 'group',
    defaultLen: 2,
    properties: [],
  };

  it('add remove CustomProperty', function () {
    const flow = new Flow();

    // remove should do nothing when #custom is undefined
    removeCustomProperty(flow, 'a');
    expect(flow.getValue('#custom')).not.toBeDefined();

    // add invalid desc
    addCustomProperty(flow, {} as any);
    expect(flow.getValue('#custom')).not.toBeDefined();

    // add invalid desc
    addCustomProperty(flow, {...descBlank});
    expect(flow.getValue('#custom')).not.toBeDefined();

    // add property into group that doesn't exist
    addCustomProperty(flow, descA, 'g');
    expect(flow.getValue('#custom')).not.toBeDefined();

    addCustomProperty(flow, descA);
    expect(flow.getValue('#custom')).toEqual([descA]);
    expect(flow.getValue('@b-p')).toEqual(['a']);

    addCustomProperty(flow, descB);
    expect(flow.getValue('#custom')).toEqual([descA, descB]);
    expect(flow.getValue('@b-p')).toEqual(['a', 'b']);

    // when prop name is same, overwrite the previous one
    addCustomProperty(flow, descA2);
    expect(flow.getValue('#custom')).toEqual([descA2, descB]);

    // add property into group that doesn't exist
    addCustomProperty(flow, descA, 'g');
    expect(flow.getValue('#custom')).toEqual([descA2, descB]);

    addCustomProperty(flow, descG);
    expect(flow.getValue('#custom')).toEqual([descA2, descB, descG]);
    expect(flow.getValue('@b-p')).toEqual(['a', 'b']);

    // add property into group
    addCustomProperty(flow, descA2, 'g');
    expect(flow.getValue('#custom')).toEqual([descA2, descB, {...descG, properties: [descA2]}]);
    expect(flow.getValue('@b-p')).toEqual(['a', 'b']);

    // cant add property name ends with number into a group
    addCustomProperty(flow, descBNumber, 'g');
    expect(flow.getValue('#custom')).toEqual([descA2, descB, {...descG, properties: [descA2]}]);

    // add property with blank name into group
    addCustomProperty(flow, descBlank, 'g');
    expect(flow.getValue('#custom')).toEqual([descA2, descB, {...descG, properties: [descA2, descBlank]}]);
    expect(flow.getValue('@b-p')).toEqual(['a', 'b', '0']);

    // replace property in group
    addCustomProperty(flow, descA, 'g');
    expect(flow.getValue('#custom')).toEqual([descA2, descB, {...descG, properties: [descA, descBlank]}]);

    // replace the group
    addCustomProperty(flow, descG2);
    expect(flow.getValue('#custom')).toEqual([descA2, descB, descG2Fix]);
    expect(flow.getValue('@b-p')).toEqual(['a', 'b']);

    addCustomProperty(flow, descA, 'g');
    expect(flow.getValue('#custom')).toEqual([descA2, descB, {...descG2Fix, properties: [descA]}]);
    expect(flow.getValue('@b-p')).toEqual(['a', 'b', 'a0', 'a1']);

    // remove property from group
    flow.setValue('a0', 1);
    removeCustomProperty(flow, 'a', 'g');
    expect(flow.getValue('#custom')).toEqual([descA2, descB, descG2Fix]);
    expect(flow.getValue('@b-p')).toEqual(['a', 'b']);
    expect(flow.getValue('a0')).not.toBeDefined();
    // again
    removeCustomProperty(flow, 'a', 'g');
    expect(flow.getValue('#custom')).toEqual([descA2, descB, descG2Fix]);

    flow.setValue('a', 1);
    removeCustomProperty(flow, 'a');
    expect(flow.getValue('#custom')).toEqual([descB, descG2Fix]);
    expect(flow.getValue('@b-p')).toEqual(['b']);
    expect(flow.getValue('a')).not.toBeDefined();
    // again
    removeCustomProperty(flow, 'a');
    expect(flow.getValue('#custom')).toEqual([descB, descG2Fix]);

    // remove the group
    removeCustomProperty(flow, null, 'g');
    expect(flow.getValue('#custom')).toEqual([descB]);
    // again
    removeCustomProperty(flow, null, 'g');
    expect(flow.getValue('#custom')).toEqual([descB]);

    // remove nothing
    removeCustomProperty(flow, null, null);
    expect(flow.getValue('#custom')).toEqual([descB]);

    // cleared
    removeCustomProperty(flow, 'b');
    expect(flow.getValue('#custom')).not.toBeDefined();
  });

  it('move CustomProperty', function () {
    const flow = new Flow();

    moveCustomProperty(flow, 'a', 'b');
    expect(flow.getValue('#custom')).not.toBeDefined();

    moveCustomProperty(flow, 'a', 'a');
    expect(flow.getValue('#custom')).not.toBeDefined();

    flow.setValue('#custom', [
      descA,
      {
        ...descG,
        properties: [descA, descC],
      },
      descB,
    ]);

    moveCustomProperty(flow, 'a', 'b');
    expect(flow.getValue('#custom')).toEqual([{...descG, properties: [descA, descC]}, descB, descA]);

    moveCustomProperty(flow, 'a', 'b');
    expect(flow.getValue('#custom')).toEqual([{...descG, properties: [descA, descC]}, descA, descB]);

    moveCustomProperty(flow, 'a', 'g');
    expect(flow.getValue('#custom')).toEqual([descA, {...descG, properties: [descA, descC]}, descB]);

    moveCustomProperty(flow, 'a', 'c', 'g');
    expect(flow.getValue('#custom')).toEqual([descA, {...descG, properties: [descC, descA]}, descB]);

    moveCustomProperty(flow, 'a', 'c', 'g2'); // group doesn't exist
    expect(flow.getValue('#custom')).toEqual([descA, {...descG, properties: [descC, descA]}, descB]);

    moveCustomProperty(flow, 'a', 'c'); // property doesn't exist
    expect(flow.getValue('#custom')).toEqual([descA, {...descG, properties: [descC, descA]}, descB]);

    moveCustomProperty(flow, 'c', 'b'); // property doesn't exist
    expect(flow.getValue('#custom')).toEqual([descA, {...descG, properties: [descC, descA]}, descB]);
  });
});
