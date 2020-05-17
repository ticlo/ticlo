import {assert} from 'chai';
import '../../functions/basic/math/Arithmetic';
import {WorkerFlow} from '../../worker/WorkerFlow';
import {copyProperties, deleteProperties, pasteProperties} from '../CopyPaste';
import {DataMap} from '../../util/DataTypes';

describe('Copy Paste', function () {
  const data = {
    '#is': '',
    'add': {'#is': 'add', '@b-xyw': [100, 100, 100]},
    '#shared': {'#is': '', 'subtract': {'#is': 'subtract'}},
  };
  const copy = {
    'add': {'#is': 'add', '@b-xyw': [100, 100, 100]},
    '#shared': {subtract: {'#is': 'subtract'}},
  };

  it('basic', function () {
    let flow1 = new WorkerFlow();

    flow1.load(data);
    let copied = copyProperties(flow1, ['add', '#shared.subtract']) as DataMap;
    assert.deepEqual(copied, copy);

    let flow2 = new WorkerFlow();
    assert.deepEqual(pasteProperties(flow2, copied), ['add', '#shared.subtract']);
    assert.deepEqual(flow2.save(), data);

    deleteProperties(flow1, ['add', '#shared.subtract']);
    assert.deepEqual(flow1.save(), {'#is': ''});

    flow1.destroy();
    flow2.destroy();
  });

  it('rename', function () {
    let flow1 = new WorkerFlow();
    flow1.load(data);

    flow1.createBlock('divide')._load({'#is': 'divide', '~0': '##.add.0', '@b-xyw': 'add'});

    let copied1 = copyProperties(flow1, ['add', 'divide']) as DataMap;
    let copied2 = copyProperties(flow1, ['#shared.subtract']) as DataMap;

    pasteProperties(flow1, copied1, 'rename');
    pasteProperties(flow1, copied2, 'rename');

    assert.deepEqual(flow1.save(), {
      '#is': '',
      '#shared': {
        '#is': '',
        'subtract': {'#is': 'subtract'},
        'subtract1': {'#is': 'subtract'},
      },
      'add': {'#is': 'add', '@b-xyw': [100, 100, 100]},
      'divide': {'#is': 'divide', '~0': '##.add.0', '@b-xyw': 'add'},
      'add1': {'#is': 'add', '@b-xyw': [124, 124, 100]},
      'divide1': {'#is': 'divide', '~0': '##.add1.0', '@b-xyw': 'add1'},
    });

    flow1.destroy();
  });

  it('invalid copy paste', function () {
    let flow1 = new WorkerFlow();
    assert.equal(copyProperties(flow1, ['add', '#shared.subtract']), 'nothing to copy');
    assert.equal(pasteProperties(flow1, null), 'invalid data');
    assert.equal(pasteProperties(flow1, []), 'invalid data');
    assert.equal(pasteProperties(flow1, 1 as any), 'invalid data');

    flow1.load(data);
    assert.isTrue((pasteProperties(flow1, copy) as string).startsWith('block already exists: '));

    assert.equal(pasteProperties(flow1.getValue('add'), copy), '#shared properties not allowed in this Block');
  });
});
