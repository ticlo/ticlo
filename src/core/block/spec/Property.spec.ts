import {assert} from "chai";
import {Job} from "../Block";

describe("Property Save Load", function () {
  it('save object with #is', function () {
    let job = new Job();

    let v1Data = {'#is': 'add'};
    let expectedSave = {
      '#is': '',
      'v1': {
        '#is': {'#is': 'add'}
      }
    };

    job.setValue('v1', v1Data);

    let saved = job.save();
    assert.deepEqual(saved, expectedSave);

    job.load(expectedSave);
    assert.deepEqual(job.getValue('v1'), v1Data);

    job.liveUpdate(expectedSave);
    assert.deepEqual(job.getValue('v1'), v1Data);
  });
});
