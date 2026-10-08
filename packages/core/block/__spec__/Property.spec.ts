import {expect} from 'vitest';
import {Flow} from '../Flow.ts';

describe('Property Save Load', function () {
  it.each(['source', 'object.value', 'missing.value'])(
    'restores a runtime preview from binding %s without changing the saved binding',
    function (binding) {
      const flow = new Flow();
      flow.load({'source': 10, 'object': {value: 20}, '~target': binding});
      const saved = flow.save();
      const target = flow.getProperty('target');
      flow.updateValue('source', 40);
      flow.updateValue('object', {value: 40});
      target.updateValue(100);
      target.revertUpdate();
      expect(target.getValue()).toBe(binding === 'missing.value' ? undefined : 40);
      expect(target._bindingPath).toBe(binding);
      expect(flow.save()).toEqual(saved);
      flow.destroy();
    }
  );

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
