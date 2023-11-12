import expect from 'expect';
import {Block} from '../Block';
import {Flow, Root} from '../Flow';
import {PropDispatcher} from '../Dispatcher';
import {voidProperty} from '../Void';
import {BlockIO} from '../BlockProperty';
import {VoidListeners} from './TestFunction';
import {_strictMode} from '../BlockSettings';

describe('Destroyed Block', function () {
  it('throw on destroyed block in strict mode', function () {
    if (_strictMode) {
      let flow = new Flow();

      let block = flow.createBlock('a');
      let propB = flow.getProperty('b');

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
      let flow = new Flow();

      let block = flow.createBlock('a');
      let propB = flow.getProperty('b');

      flow.setValue('a', null);

      expect(block.isDestroyed()).toBeTruthy();

      expect(block.getProperty('a')).toEqual(voidProperty);
      expect(block.createBinding('##', propB)).toEqual(voidProperty);
      expect(() => block.watch(VoidListeners)).not.toThrow();
      expect(block._watchers).toBeNull();

      block.destroy(); // destroy twice should be safe
    }
  });
});
