import {assert} from "chai";

import {addMoreProperty, removeMoreProperty} from "../MoreProperty";
import {Job} from "../../block/Block";
import {PropDesc, PropGroupDesc} from "../../block/Descriptor";


describe("More Property", function () {

  it('add remove MoreProperty', function () {

    let propDesc1: PropDesc = {name: 'a', type: 'string'};
    let propDesc2: PropDesc = {name: 'b', type: 'number'};
    let propDesc3: PropDesc = {name: 'a', type: 'number'};
    let groupDesc1: PropGroupDesc = {name: 'g', type: 'group', defaultLen: 1, properties: []};
    let groupDesc2: PropGroupDesc = {name: 'g', type: 'group'} as PropGroupDesc; // automatically fix group desc
    let groupDesc2Fixed: PropGroupDesc = {name: 'g', type: 'group', defaultLen: 2, properties: []};

    let job = new Job();

    // remove should do nothing when #more is undefined
    removeMoreProperty(job, 'a');
    assert.isUndefined(job.getValue('#more'));

    // add invalid desc
    addMoreProperty(job, {} as any);
    assert.isUndefined(job.getValue('#more'));

    // add property into group that doesn't exist
    addMoreProperty(job, propDesc1, 'g');
    assert.isUndefined(job.getValue('#more'));

    addMoreProperty(job, propDesc1);
    assert.deepEqual(job.getValue('#more'), [propDesc1]);
    addMoreProperty(job, propDesc2);
    assert.deepEqual(job.getValue('#more'), [propDesc1, propDesc2]);

    // when prop name is same, overwrite the previous one
    addMoreProperty(job, propDesc3);
    assert.deepEqual(job.getValue('#more'), [propDesc3, propDesc2]);

    // add property into group that doesn't exist
    addMoreProperty(job, propDesc1, 'g');
    assert.deepEqual(job.getValue('#more'), [propDesc3, propDesc2]);

    addMoreProperty(job, groupDesc1);
    assert.deepEqual(job.getValue('#more'), [propDesc3, propDesc2, groupDesc1]);

    // add property into group
    addMoreProperty(job, propDesc1, 'g');
    assert.deepEqual(job.getValue('#more'), [propDesc3, propDesc2, {...groupDesc1, properties: [propDesc1]}]);

    // replace property in group
    addMoreProperty(job, propDesc3, 'g');
    assert.deepEqual(job.getValue('#more'), [propDesc3, propDesc2, {...groupDesc1, properties: [propDesc3]}]);

    // replace the group
    addMoreProperty(job, groupDesc2);
    assert.deepEqual(job.getValue('#more'), [propDesc3, propDesc2, groupDesc2Fixed]);


    addMoreProperty(job, propDesc1, 'g');
    assert.deepEqual(job.getValue('#more'), [propDesc3, propDesc2, {...groupDesc2Fixed, properties: [propDesc1]}]);

    // remove property from group
    removeMoreProperty(job, 'a', 'g');
    assert.deepEqual(job.getValue('#more'), [propDesc3, propDesc2, groupDesc2Fixed]);
    // again
    removeMoreProperty(job, 'a', 'g');
    assert.deepEqual(job.getValue('#more'), [propDesc3, propDesc2, groupDesc2Fixed]);

    removeMoreProperty(job, 'a');
    assert.deepEqual(job.getValue('#more'), [propDesc2, groupDesc2Fixed]);
    // again
    removeMoreProperty(job, 'a');
    assert.deepEqual(job.getValue('#more'), [propDesc2, groupDesc2Fixed]);

    // remove the group
    removeMoreProperty(job, null, 'g');
    assert.deepEqual(job.getValue('#more'), [propDesc2]);
    // again
    removeMoreProperty(job, null, 'g');
    assert.deepEqual(job.getValue('#more'), [propDesc2]);


    // remove nothing
    removeMoreProperty(job, null, null);
    assert.deepEqual(job.getValue('#more'), [propDesc2]);

  });

  it('move MoreProperty', function () {
    let job = new Job();
    job.setValue('#more', [
      {name: 'a', type: 'string'},
      {name: 'g', type: 'group', defaultLen: 1, properties: []}
    ]);
  });
});
