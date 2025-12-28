import {expect} from 'vitest';
import '../../functions/math/Arithmetic.js';
import {WorkerFlow} from '../../worker/WorkerFlow.js';
import {copyProperties, deleteProperties, pasteProperties} from '../CopyPaste.js';
import {DataMap} from '../../util/DataTypes.js';
import type {Block} from '../../block/Block.js';

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
    const flow1 = new WorkerFlow();

    flow1.load(data);
    const copied = copyProperties(flow1, ['add', '#shared.subtract']) as DataMap;
    expect(copied).toEqual(copy);

    const flow2 = new WorkerFlow();
    expect(pasteProperties(flow2, copied)).toEqual(['add', '#shared.subtract']);
    expect(flow2.save()).toEqual(data);

    deleteProperties(flow1, ['add', '#shared.subtract']);
    expect(flow1.save()).toEqual({'#is': ''});

    flow1.destroy();
    flow2.destroy();
  });

  it('rename', function () {
    const flow1 = new WorkerFlow();
    flow1.load(data);

    flow1.createBlock('divide')._load({'#is': 'divide', '~0': '##.add.0', '@b-xyw': 'add'});

    const copied1 = copyProperties(flow1, ['add', 'divide']) as DataMap;
    const copied2 = copyProperties(flow1, ['#shared.subtract']) as DataMap;

    pasteProperties(flow1, copied1, 'rename');
    pasteProperties(flow1, copied2, 'rename');

    expect(flow1.save()).toEqual({
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
    const flow1 = new WorkerFlow();
    expect(copyProperties(flow1, ['add', '#shared.subtract'])).toBe('nothing to copy');
    expect(pasteProperties(flow1, null)).toBe('invalid data');
    expect(pasteProperties(flow1, [] as any)).toBe('invalid data');
    expect(pasteProperties(flow1, 1 as any)).toBe('invalid data');

    flow1.load(data);
    expect((pasteProperties(flow1, copy) as string).startsWith('block already exists: ')).toBe(true);

    expect(pasteProperties(flow1.getValue('add') as Block, copy)).toBe('#shared properties not allowed in this Block');
  });
});
