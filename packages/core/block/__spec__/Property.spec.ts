import {expect} from 'vitest';
import {Flow} from '../Flow.js';

describe('Property Save Load', function () {
  it('save object with #is', function () {
    const flow = new Flow();

    const v1Data = {'#is': 'add'};
    const expectedSave = {
      '#is': '',
      'v1': {
        '#is': {'#is': 'add'},
      },
    };

    flow.setValue('v1', v1Data);

    const saved = flow.save();
    expect(saved).toEqual(expectedSave);

    flow.load(expectedSave);
    expect(flow.getValue('v1')).toEqual(v1Data);

    flow.liveUpdate(expectedSave);
    expect(flow.getValue('v1')).toEqual(v1Data);
  });
});
