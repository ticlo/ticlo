import {expect} from 'vitest';

import {Block} from '../../block/Block.js';
import {Flow} from '../../block/Flow.js';
import '../../functions/math/Arithmetic.js';
import {findPropertyForNewBlock, renameProperty} from '../PropertyName.js';

describe('PropertyUtil', function () {
  it('findPropertyForNewBlock', function () {
    let flow = new Flow();
    flow.setValue('#custom', [{name: 'add4', type: 'sting'}]);

    flow.setBinding('add2', 'add1');

    let p = findPropertyForNewBlock(flow, 'add');
    expect(p._name).toBe('add');
    p.setValue(1);

    p = findPropertyForNewBlock(flow, 'add');
    expect(p._name).toBe('add1');
    p.setValue(1);

    // skip 2 names because they are already used
    p = findPropertyForNewBlock(flow, 'add');
    expect(p._name).toBe('add3');
    p.setValue(1);

    // skip add4 because it's defined in #custom
    p = findPropertyForNewBlock(flow, 'add');
    expect(p._name).toBe('add5');
  });

  it('renameProperty', function () {
    let flow = new Flow();

    // move undefined property
    renameProperty(flow, 'a0', 'b0', true);
    expect(flow.isPropertyUsed('b0')).toBe(false);

    // move value
    flow.setValue('a1', 1);
    renameProperty(flow, 'a1', 'b1');
    expect(flow.isPropertyUsed('a1')).toBe(false);
    expect(flow.getValue('b1')).toBe(1);

    // move binding
    flow.setBinding('a2', 'b1');
    renameProperty(flow, 'a2', 'b2');
    expect(flow.isPropertyUsed('a2')).toBe(false);
    expect(flow.getProperty('b2')._bindingPath).toBe('b1');

    // move block
    flow.createBlock('a3').setValue('v', 2);
    renameProperty(flow, 'a3', 'b3');
    expect(flow.isPropertyUsed('a3')).toBe(false);
    expect(flow.getValue('b3')).toBeInstanceOf(Block);
    expect(flow.queryValue('b3.v')).toBe(2);

    // move sub block
    flow.createHelperBlock('a4').setValue('v', 3);
    renameProperty(flow, 'a4', 'b4');
    expect(flow.isPropertyUsed('a4')).toBe(false);
    expect(flow.getValue('~b4')).toBeInstanceOf(Block);
    expect(flow.queryValue('~b4.v')).toBe(3);
    expect(flow.getProperty('b4')._bindingPath).toBe('~b4.#output');

    // move binding
    flow.setValue('a5', 4);
    flow.setBinding('c5', 'a5');
    renameProperty(flow, 'a5', 'b5', true);
    expect(flow.isPropertyUsed('a5')).toBe(false);
    expect(flow.getProperty('c5')._bindingPath).toBe('b5');

    // move child binding
    flow.createBlock('a6').setValue('v', 5);
    flow.setBinding('c6', 'a6.v');
    renameProperty(flow, 'a6', 'b6', true);
    expect(flow.isPropertyUsed('a6')).toBe(false);
    expect(flow.getProperty('c6')._bindingPath).toBe('b6.v');

    // move child binding with same children names
    let a7 = flow.createBlock('a7');
    a7.createBlock('a7').createBlock('a7').setValue('v', 6);
    flow.setBinding('c7', 'a7.a7.a7.v');
    renameProperty(a7, 'a7', 'b7', true);
    expect(a7.isPropertyUsed('a7')).toBe(false);
    expect(flow.getProperty('c7')._bindingPath).toBe('a7.b7.a7.v');

    // move indirect binding
    flow.setValue('a8', 7);
    flow.createBlock('c8').setBinding('v', '##.a8');
    renameProperty(flow, 'a8', 'b8', true);
    expect(flow.isPropertyUsed('a8')).toBe(false);
    expect(flow.queryProperty('c8.v')._bindingPath).toBe('##.b8');
  });
});
