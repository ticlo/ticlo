import {expect} from 'vitest';
import {Block} from '../Block.ts';
import {Flow, Root} from '../Flow.ts';
import {PropDispatcher} from '../Dispatcher.ts';
import {voidProperty} from '../Void.ts';
import {BlockIO} from '../BlockProperty.ts';
import {VoidListeners} from './TestFunction.ts';
import {_strictMode} from '../BlockSettings.ts';

describe('Destroyed Block', function () {
  it('throw on destroyed block in strict mode', function () {
    if (_strictMode) {
      const flow = new Flow();

      const block = flow.createBlock('a');
      const propB = flow.getProperty('b');

      flow.setValue('a', null);

      expect(block.isDestroyed()).toBeTruthy();

      expect(() => block.getProperty('a')).toThrow();
      expect(() => block.setValue('a', 1)).toThrow();
      expect(() => block.updateValue('a', 1)).toThrow();
      expect(() => block.setBinding('a', 'b')).toThrow();
      expect(() => block.output(1)).toThrow();
      expect(() => block.createBinding('##', propB)).toThrow();
      expect(() => block.watch(VoidListeners)).toThrow();

      block.destroy(); // destroy twice should be safe
    }
  });

  it('void on destroyed block in normal mode', function () {
    if (!_strictMode) {
      const flow = new Flow();

      const block = flow.createBlock('a');
      const propB = flow.getProperty('b');

      flow.setValue('a', null);

      expect(block.isDestroyed()).toBeTruthy();

      expect(block.getProperty('a')).toBe(voidProperty);
      expect(block.createBinding('##', propB)).toBe(voidProperty);
      expect(() => block.watch(VoidListeners)).not.toThrow();
      expect(block._watchers).toBeNull();

      block.destroy(); // destroy twice should be safe
    }
  });
});
