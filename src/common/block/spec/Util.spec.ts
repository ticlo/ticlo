import {assert} from "chai";

import {Block, Job} from "../Block";
import {BlockPropertyEvent} from "../BlockProperty";
import {Dispatcher} from "../Dispatcher";
import {VoidListeners} from "./TestFunction";
import {anyChildProperty} from "../Util";

describe("Block Util", function () {

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

});
