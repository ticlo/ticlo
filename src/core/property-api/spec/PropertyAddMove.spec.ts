import {assert} from "chai";

import {Block, Job} from "../../block/Block";
import {BlockPropertyEvent} from "../../block/BlockProperty";
import {Dispatcher} from "../../block/Dispatcher";
import {findPropertyForNewBlock, renameProperty, changeLength} from "../PropertyAddMove";

describe("PropertyUtil", function () {

  it('findPropertyForNewBlock', function () {

    let job = new Job();
    job.setValue('#more', [{name: 'add4', type: 'sting'}]);

    job.setValue('add1', 1);
    job.setBinding('add2', 'add1');

    let p = findPropertyForNewBlock(job, 'add');
    assert.equal(p._name, 'add');
    p.setValue(1);

    p = findPropertyForNewBlock(job, 'add');
    assert.equal(p._name, 'add0');
    p.setValue(1);

    // skip 2 names because they are already used
    p = findPropertyForNewBlock(job, 'add');
    assert.equal(p._name, 'add3');
    p.setValue(1);

    // skip add4 because it's defined in #more
    p = findPropertyForNewBlock(job, 'add');
    assert.equal(p._name, 'add5');
  });

  it('renameProperty', function () {
    let job = new Job();

    // move undefined property
    renameProperty(job, 'a0', 'b0', true);
    assert.isFalse(job.isPropertyUsed('b0'));

    // move value
    job.setValue('a1', 1);
    renameProperty(job, 'a1', 'b1');
    assert.isFalse(job.isPropertyUsed('a1'));
    assert.equal(job.getValue('b1'), 1);

    // move binding
    job.setBinding('a2', 'b1');
    renameProperty(job, 'a2', 'b2');
    assert.isFalse(job.isPropertyUsed('a2'));
    assert.equal(job.getProperty('b2')._bindingPath, 'b1');

    // move block
    job.createBlock('a3').setValue('v', 2);
    renameProperty(job, 'a3', 'b3');
    assert.isFalse(job.isPropertyUsed('a3'));
    assert.instanceOf(job.getValue('b3'), Block);
    assert.equal(job.queryValue('b3.v'), 2);

    // move sub block
    job.createHelperBlock('a4').setValue('v', 3);
    renameProperty(job, 'a4', 'b4');
    assert.isFalse(job.isPropertyUsed('a4'));
    assert.instanceOf(job.getValue('~b4'), Block);
    assert.equal(job.queryValue('~b4.v'), 3);
    assert.equal(job.getProperty('b4')._bindingPath, '~b4.output');

    // move binding
    job.setValue('a5', 4);
    job.setBinding('c5', 'a5');
    renameProperty(job, 'a5', 'b5', true);
    assert.isFalse(job.isPropertyUsed('a5'));
    assert.equal(job.getProperty('c5')._bindingPath, 'b5');

    // move child binding
    job.createBlock('a6').setValue('v', 5);
    job.setBinding('c6', 'a6.v');
    renameProperty(job, 'a6', 'b6', true);
    assert.isFalse(job.isPropertyUsed('a6'));
    assert.equal(job.getProperty('c6')._bindingPath, 'b6.v');

    // move child binding with same children names
    let a7 = job.createBlock('a7');
    a7.createBlock('a7').createBlock('a7').setValue('v', 6);
    job.setBinding('c7', 'a7.a7.a7.v');
    renameProperty(a7, 'a7', 'b7', true);
    assert.isFalse(a7.isPropertyUsed('a7'));
    assert.equal(job.getProperty('c7')._bindingPath, 'a7.b7.a7.v');


    // move indirect binding
    job.setValue('a8', 7);
    job.createBlock('c8').setBinding('v', '##.a8');
    renameProperty(job, 'a8', 'b8', true);
    assert.isFalse(job.isPropertyUsed('a8'));
    assert.equal(job.queryProperty('c8.v')._bindingPath, '##.b8');

  });

  it('change length', function () {
    let job = new Job();
    job.load({
      '#is': 'add'
    });

    changeLength(job, '#len', 3);
    assert.deepEqual(job.getValue('#len'), 3);
    assert.deepEqual(job.getValue('@b-p'), ['2']);

    changeLength(job, '#len', 0);
    assert.isUndefined(job.getValue('@b-p'));

    changeLength(job, '#len', 3);
    assert.deepEqual(job.getValue('@b-p'), ['0', '1', '2']);

  });
});
