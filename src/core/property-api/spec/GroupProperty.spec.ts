import expect from 'expect';

import {Block} from '../../block/Block';
import {Flow} from '../../block/Flow';
import '../../functions/math/Arithmetic';
import {insertGroupProperty, moveGroupProperty, removeGroupProperty, setGroupLength} from '../GroupProperty';

describe('GroupProperty', function () {
  it('setGroupLength', function () {
    let flow = new Flow();
    let aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'add',
    });

    setGroupLength(aBlock, '', 3);
    expect(aBlock.getValue('[]')).toEqual(3);
    expect(aBlock.getValue('@b-p')).toEqual(['2']);

    setGroupLength(aBlock, '', 0);
    expect(aBlock.getValue('@b-p')).not.toBeDefined();

    setGroupLength(aBlock, '', 3);
    expect(aBlock.getValue('@b-p')).toEqual(['0', '1', '2']);

    // set -1 will use default length
    setGroupLength(aBlock, '', -1);
    expect(aBlock.getValue('@b-p')).toEqual(['0', '1']);

    // invalid group, length should change but nothing else should happen
    setGroupLength(aBlock, 'invalidG', 3);
    expect(aBlock.getValue('invalidG[]')).toEqual(3);
    expect(aBlock.getValue('@b-p')).toEqual(['0', '1']);
  });

  it('setGroupLength on #custom', function () {
    let flow = new Flow();
    flow.load({
      '#is': '',
      '#custom': [
        {
          name: 'g',
          type: 'group',
          defaultLen: 2,
          properties: [{name: 'a', type: 'number', pinned: true}],
        },
      ],
    });

    setGroupLength(flow, 'g', 3);
    expect(flow.getValue('g[]')).toEqual(3);
    expect(flow.getValue('@b-p')).toEqual(['a2']);
  });

  it('insertGroupProperty', function () {
    let flow = new Flow();
    let aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'add',
      '0': 0,
      '1': 1,
    });

    insertGroupProperty(aBlock, '', 0);
    expect(aBlock.getValue('[]')).toEqual(3);
    expect(aBlock.getValue('1')).toEqual(0);

    insertGroupProperty(aBlock, '', 3);
    expect(aBlock.getValue('[]')).toEqual(4);

    // invalid index, no change
    insertGroupProperty(aBlock, '', -1);
    insertGroupProperty(aBlock, '', 100);
    expect(aBlock.getValue('[]')).toEqual(4);

    // invalid group, no change
    insertGroupProperty(aBlock, 'invalidG', 0);
    expect(aBlock.getValue('invalidG[]')).not.toBeDefined();
  });

  it('removeGroupProperty', function () {
    let flow = new Flow();
    let aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'add',
      '0': 0,
      '1': 1,
    });

    removeGroupProperty(aBlock, '', 0);
    expect(aBlock.getValue('[]')).toEqual(1);
    expect(aBlock.getValue('0')).toEqual(1);

    // invalid index, no change
    removeGroupProperty(aBlock, '', -1);
    removeGroupProperty(aBlock, '', 100);
    expect(aBlock.getValue('[]')).toEqual(1);

    // invalid group, no change
    removeGroupProperty(aBlock, 'invalidG', 0);
    expect(aBlock.getValue('invalidG[]')).not.toBeDefined();
  });

  it('moveGroupProperty', function () {
    let flow = new Flow();
    let aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'add',
      '0': 0,
      '1': 1,
    });

    moveGroupProperty(aBlock, '', 0, 1);
    expect(aBlock.getValue('0')).toEqual(1);
    expect(aBlock.getValue('1')).toEqual(0);

    moveGroupProperty(aBlock, '', 1, 0);
    expect(aBlock.getValue('0')).toEqual(0);
    expect(aBlock.getValue('1')).toEqual(1);

    // invalid index, no change
    moveGroupProperty(aBlock, '', 1, 100);
    moveGroupProperty(aBlock, '', 100, 0);
    moveGroupProperty(aBlock, '', 0, 0);
    expect(aBlock.getValue('0')).toEqual(0);
    expect(aBlock.getValue('1')).toEqual(1);

    // invalid group, no change
    moveGroupProperty(aBlock, 'invalidG', 0, 1);
    expect(aBlock.getValue('invalidG[]')).not.toBeDefined();
  });
});
