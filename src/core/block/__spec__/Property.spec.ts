import {expect} from 'vitest';
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
    expect(saved).toEqual(expectedSave);

    flow.load(expectedSave);
    expect(flow.getValue('v1')).toEqual(v1Data);

    flow.liveUpdate(expectedSave);
    expect(flow.getValue('v1')).toEqual(v1Data);
  });
});
