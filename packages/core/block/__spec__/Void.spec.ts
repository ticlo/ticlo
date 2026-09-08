import {expect} from 'vitest';

import '../Flow.ts';
import {voidProperty} from '../Void.ts';
import {BlockPropertyEvent} from '../BlockProperty.ts';
import {PropDispatcher} from '../Dispatcher.ts';
import {VoidListeners} from './TestFunction.ts';
import {_strictMode} from '../BlockSettings.ts';

describe('VoidProperty', function () {
  it('basic', function () {
    voidProperty.setValue(1);
    expect(voidProperty.getValue()).not.toBeDefined();
    voidProperty.updateValue(2);
    voidProperty.setBinding('a');
    expect(voidProperty.getValue()).not.toBeDefined();

    voidProperty.listen(VoidListeners);
    expect(voidProperty._listeners).toEqual(new Set());

    voidProperty.subscribe(VoidListeners);
    expect(voidProperty._subscribers).not.toBeDefined();

    if (_strictMode) {
      expect(() => voidProperty._saveValue()).toThrow();
      expect(() => voidProperty._load({})).toThrow();
      expect(() => voidProperty._liveUpdate({})).toThrow();
    } else {
      expect(voidProperty._saveValue()).not.toBeDefined();
      voidProperty._load(123);
      expect(voidProperty.getValue()).not.toBeDefined();
      voidProperty._liveUpdate('123');
      expect(voidProperty.getValue()).not.toBeDefined();
    }
  });
});
