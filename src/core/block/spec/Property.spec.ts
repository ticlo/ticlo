import {assert} from 'chai';
import {Flow} from '../Flow';

describe('Property Save Load', function () {
  it('save object with #is', function () {
    let flow = new Flow();

    let v1Data = {'#is': 'add'};
    let expectedSave = {
      '#is': '',
      'v1': {
        '#is': {'#is': 'add'},
      },
    };

    flow.setValue('v1', v1Data);

    let saved = flow.save();
    assert.deepEqual(saved, expectedSave);

    flow.load(expectedSave);
    assert.deepEqual(flow.getValue('v1'), v1Data);

    flow.liveUpdate(expectedSave);
    assert.deepEqual(flow.getValue('v1'), v1Data);
  });
});
