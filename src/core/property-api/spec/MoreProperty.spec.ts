import {assert} from "chai";

import {addMoreProperty, removeMoreProperty} from "../MoreProperty";
import {Job} from "../../block/Block";
import {PropDesc, PropGroupDesc} from "../../block/Descriptor";


describe("More Property", function () {

  it('add remove MoreProperty', function () {

    let propDesc1: PropDesc = {name: 'a', type: 'string'};
    let propDesc2: PropDesc = {name: 'b', type: 'number'};
    let propDesc3: PropDesc = {name: 'a', type: 'number'};
    let groupDesc1: PropGroupDesc = {group: 'g', defaultLen: 1, properties: []};
    let groupDesc2: PropGroupDesc = {group: 'g'} as PropGroupDesc; // automatically fix group desc
    let groupDesc2Fixed: PropGroupDesc = {group: 'g', defaultLen: 2, properties: []};

    let job = new Job();

    // remove should do nothing when #more is undefined
    removeMoreProperty(job, 'a');
    assert.isUndefined(job.getValue('#more'));

    // add invalid desc
    addMoreProperty(job, {} as any);
    assert.isUndefined(job.getValue('#more'));

    addMoreProperty(job, propDesc1);
    assert.deepEqual(job.getValue('#more'), [propDesc1]);
    addMoreProperty(job, propDesc2);
    assert.deepEqual(job.getValue('#more'), [propDesc1, propDesc2]);

    // when prop name is same, overwrite the previous one
    addMoreProperty(job, propDesc3);
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

    removeMoreProperty(job, 'a');
    assert.deepEqual(job.getValue('#more'), [propDesc2, groupDesc2Fixed]);

    // remove the group
    removeMoreProperty(job, null, 'g');
    assert.deepEqual(job.getValue('#more'), [propDesc2]);

    // remove nothing
    removeMoreProperty(job, null, null);
    assert.deepEqual(job.getValue('#more'), [propDesc2]);

  });
});
