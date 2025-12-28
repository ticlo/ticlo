import {expect} from 'vitest';
import '../Storage.js';
import {Flow, Root} from '../../../block/Flow.js';
import {shouldHappen, waitTick} from '../../../util/test-util.js';

describe('Storage', function () {
  it('read and write storage', async function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'write-storage',
      'input': 'a',
      'key': 'test',
    });

    Root.run();
    aBlock.updateValue('#call', {});
    Root.run();

    const bBlock = flow.createBlock('b');
    bBlock._load({
      '#is': 'read-storage',
      'key': 'test',
    });
    Root.run();
    await shouldHappen(() => bBlock.getValue('#output') === 'a');

    flow.deleteValue('a');
    flow.deleteValue('b');
  });
  it('auto refresh', async function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'write-storage',
      '#mode': 'onLoad',
      'input': 'A',
      'key': 'test',
    });

    Root.run();

    const bBlock = flow.createBlock('b');
    bBlock._load({
      '#is': 'read-storage',
      'autoRefresh': true,
      'key': 'test',
    });
    Root.run();
    await shouldHappen(() => bBlock.getValue('#output') === 'A');

    aBlock.setValue('input', 'B');
    Root.run();
    await shouldHappen(() => bBlock.getValue('#output') === 'B');

    aBlock.setValue('input', null); // delete the storage
    Root.run();
    await shouldHappen(() => bBlock.getValue('#output') === null);

    flow.deleteValue('a');
    flow.deleteValue('b');
  });
});
