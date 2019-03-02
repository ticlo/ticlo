import {assert} from "chai";

import {Block, Job} from "../../block/Block";
import {BlockPropertyEvent} from "../../block/BlockProperty";
import {Dispatcher} from "../../block/Dispatcher";
import {anyChildProperty, renameProperty} from "../Properties";

describe("PropertyUtil", function () {

  it('anyChildProperty', function () {

    let job = new Job();
    job.setValue('add1', 1);
    job.setBinding('add2', 'add1');

    let p = anyChildProperty(job, 'add');
    assert.equal(p._name, 'add');
    p.setValue(1);

    p = anyChildProperty(job, 'add');
    assert.equal(p._name, 'add0');
    p.setValue(1);

    // skip 2 names because they are already used
    p = anyChildProperty(job, 'add');
    assert.equal(p._name, 'add3');
  });

  it('renameProperty', function () {
    let job = new Job();

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
  });
});
