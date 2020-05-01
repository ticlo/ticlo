import {assert} from 'chai';
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
      let job = new Flow();

      let block = job.createBlock('a');
      let propB = job.getProperty('b');

      job.setValue('a', null);

      assert(block.isDestroyed(), 'block should be destroyed');

      assert.throw(() => block.getProperty('a'));
      assert.throw(() => block.setValue('a', 1));
      assert.throw(() => block.updateValue('a', 1));
      assert.throw(() => block.setBinding('a', 'b'));
      assert.throw(() => block.output(1));
      assert.throw(() => block.createBinding('##', propB));
      assert.throw(() => block.watch(VoidListeners));

      block.destroy(); // destroy twice should be safe
    }
  });

  it('void on destroyed block in normal mode', function () {
    if (!_strictMode) {
      let job = new Flow();

      let block = job.createBlock('a');
      let propB = job.getProperty('b');

      job.setValue('a', null);

      assert(block.isDestroyed(), 'block should be destroyed');

      assert.equal(block.getProperty('a'), voidProperty);
      assert.equal(block.createBinding('##', propB), voidProperty);
      assert.doesNotThrow(() => block.watch(VoidListeners));
      assert.isNull(block._watchers);

      block.destroy(); // destroy twice should be safe
    }
  });
});
