import {assert} from 'chai';
import {Flow} from '../Flow';

describe('Property Save Load', function () {
  it('save object with #is', function () {
    let job = new Flow();

    let v1Data = {'#is': 'add'};
    let expectedSave = {
      '#is': '',
      'v1': {
        '#is': {'#is': 'add'},
      },
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
