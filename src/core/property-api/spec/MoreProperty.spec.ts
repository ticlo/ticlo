import {assert} from "chai";

import {addMoreProperty, moveMoreProperty, removeMoreProperty} from "../MoreProperty";
import {Job} from "../../block/Block";
import {PropDesc, PropGroupDesc} from "../../block/Descriptor";


describe("More Property", function () {

  let descA: PropDesc = {name: 'a', type: 'string'};
  let descB: PropDesc = {name: 'b', type: 'number'};
  let descA2: PropDesc = {name: 'a', type: 'number'};
  let descC: PropDesc = {name: 'c', type: 'toggle'};
  let descG: PropGroupDesc = {name: 'g', type: 'group', defaultLen: 1, properties: []};
  let descG2: PropGroupDesc = {name: 'g', type: 'group'} as PropGroupDesc; // automatically fix group desc
  let descG2Fix: PropGroupDesc = {name: 'g', type: 'group', defaultLen: 2, properties: []};

  it('add remove MoreProperty', function () {

    let job = new Job();

    // remove should do nothing when #more is undefined
    removeMoreProperty(job, 'a');
    assert.isUndefined(job.getValue('#more'));

    // add invalid desc
    addMoreProperty(job, {} as any);
    assert.isUndefined(job.getValue('#more'));

    // add property into group that doesn't exist
    addMoreProperty(job, descA, 'g');
    assert.isUndefined(job.getValue('#more'));

    addMoreProperty(job, descA);
    assert.deepEqual(job.getValue('#more'), [descA]);
    addMoreProperty(job, descB);
    assert.deepEqual(job.getValue('#more'), [descA, descB]);

    // when prop name is same, overwrite the previous one
    addMoreProperty(job, descA2);
    assert.deepEqual(job.getValue('#more'), [descA2, descB]);

    // add property into group that doesn't exist
    addMoreProperty(job, descA, 'g');
    assert.deepEqual(job.getValue('#more'), [descA2, descB]);

    addMoreProperty(job, descG);
    assert.deepEqual(job.getValue('#more'), [descA2, descB, descG]);

    // add property into group
    addMoreProperty(job, descA, 'g');
    assert.deepEqual(job.getValue('#more'), [descA2, descB, {...descG, properties: [descA]}]);

    // replace property in group
    addMoreProperty(job, descA2, 'g');
    assert.deepEqual(job.getValue('#more'), [descA2, descB, {...descG, properties: [descA2]}]);

    // replace the group
    addMoreProperty(job, descG2);
    assert.deepEqual(job.getValue('#more'), [descA2, descB, descG2Fix]);


    addMoreProperty(job, descA, 'g');
    assert.deepEqual(job.getValue('#more'), [descA2, descB, {...descG2Fix, properties: [descA]}]);

    // remove property from group
    removeMoreProperty(job, 'a', 'g');
    assert.deepEqual(job.getValue('#more'), [descA2, descB, descG2Fix]);
    // again
    removeMoreProperty(job, 'a', 'g');
    assert.deepEqual(job.getValue('#more'), [descA2, descB, descG2Fix]);

    removeMoreProperty(job, 'a');
    assert.deepEqual(job.getValue('#more'), [descB, descG2Fix]);
    // again
    removeMoreProperty(job, 'a');
    assert.deepEqual(job.getValue('#more'), [descB, descG2Fix]);

    // remove the group
    removeMoreProperty(job, null, 'g');
    assert.deepEqual(job.getValue('#more'), [descB]);
    // again
    removeMoreProperty(job, null, 'g');
    assert.deepEqual(job.getValue('#more'), [descB]);


    // remove nothing
    removeMoreProperty(job, null, null);
    assert.deepEqual(job.getValue('#more'), [descB]);

  });

  it('move MoreProperty', function () {
    let job = new Job();
    job.setValue('#more', [
      descA,
      {
        ...descG, properties: [
          descA,
          descC,
        ]
      },
      descB,
    ]);

    moveMoreProperty(job, 'a', 'b');
    assert.deepEqual(job.getValue('#more'), [
      {...descG, properties: [descA, descC]},
      descB,
      descA,
    ]);

    moveMoreProperty(job, 'a', 'b');
    assert.deepEqual(job.getValue('#more'), [
      {...descG, properties: [descA, descC]},
      descA,
      descB,
    ]);

    moveMoreProperty(job, 'a', 'g');
    assert.deepEqual(job.getValue('#more'), [
      descA,
      {...descG, properties: [descA, descC]},
      descB,
    ]);

    moveMoreProperty(job, 'a', 'c', 'g');
    assert.deepEqual(job.getValue('#more'), [
      descA,
      {...descG, properties: [descC, descA]},
      descB,
    ]);

  });
});
