import {assert} from 'chai';

import {Block} from '../../block/Block';
import {Flow} from '../../block/Flow';
import '../../functions/basic/math/Arithmetic';
import {findPropertyForNewBlock, renameProperty} from '../PropertyName';

describe('PropertyUtil', function () {
  it('findPropertyForNewBlock', function () {
    let flow = new Flow();
    flow.setValue('#custom', [{name: 'add4', type: 'sting'}]);

    flow.setBinding('add2', 'add1');

    let p = findPropertyForNewBlock(flow, 'add');
    assert.equal(p._name, 'add');
    p.setValue(1);

    p = findPropertyForNewBlock(flow, 'add');
    assert.equal(p._name, 'add1');
    p.setValue(1);

    // skip 2 names because they are already used
    p = findPropertyForNewBlock(flow, 'add');
    assert.equal(p._name, 'add3');
    p.setValue(1);

    // skip add4 because it's defined in #custom
    p = findPropertyForNewBlock(flow, 'add');
    assert.equal(p._name, 'add5');
  });

  it('renameProperty', function () {
    let flow = new Flow();

    // move undefined property
    renameProperty(flow, 'a0', 'b0', true);
    assert.isFalse(flow.isPropertyUsed('b0'));

    // move value
    flow.setValue('a1', 1);
    renameProperty(flow, 'a1', 'b1');
    assert.isFalse(flow.isPropertyUsed('a1'));
    assert.equal(flow.getValue('b1'), 1);

    // move binding
    flow.setBinding('a2', 'b1');
    renameProperty(flow, 'a2', 'b2');
    assert.isFalse(flow.isPropertyUsed('a2'));
    assert.equal(flow.getProperty('b2')._bindingPath, 'b1');

    // move block
    flow.createBlock('a3').setValue('v', 2);
    renameProperty(flow, 'a3', 'b3');
    assert.isFalse(flow.isPropertyUsed('a3'));
    assert.instanceOf(flow.getValue('b3'), Block);
    assert.equal(flow.queryValue('b3.v'), 2);

    // move sub block
    flow.createHelperBlock('a4').setValue('v', 3);
    renameProperty(flow, 'a4', 'b4');
    assert.isFalse(flow.isPropertyUsed('a4'));
    assert.instanceOf(flow.getValue('~b4'), Block);
    assert.equal(flow.queryValue('~b4.v'), 3);
    assert.equal(flow.getProperty('b4')._bindingPath, '~b4.#output');

    // move binding
    flow.setValue('a5', 4);
    flow.setBinding('c5', 'a5');
    renameProperty(flow, 'a5', 'b5', true);
    assert.isFalse(flow.isPropertyUsed('a5'));
    assert.equal(flow.getProperty('c5')._bindingPath, 'b5');

    // move child binding
    flow.createBlock('a6').setValue('v', 5);
    flow.setBinding('c6', 'a6.v');
    renameProperty(flow, 'a6', 'b6', true);
    assert.isFalse(flow.isPropertyUsed('a6'));
    assert.equal(flow.getProperty('c6')._bindingPath, 'b6.v');

    // move child binding with same children names
    let a7 = flow.createBlock('a7');
    a7.createBlock('a7').createBlock('a7').setValue('v', 6);
    flow.setBinding('c7', 'a7.a7.a7.v');
    renameProperty(a7, 'a7', 'b7', true);
    assert.isFalse(a7.isPropertyUsed('a7'));
    assert.equal(flow.getProperty('c7')._bindingPath, 'a7.b7.a7.v');

    // move indirect binding
    flow.setValue('a8', 7);
    flow.createBlock('c8').setBinding('v', '##.a8');
    renameProperty(flow, 'a8', 'b8', true);
    assert.isFalse(flow.isPropertyUsed('a8'));
    assert.equal(flow.queryProperty('c8.v')._bindingPath, '##.b8');
  });
});
