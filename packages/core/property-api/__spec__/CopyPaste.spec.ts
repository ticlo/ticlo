import {expect} from 'vitest';
import '../../functions/math/Arithmetic.js';
import {WorkerFlow} from '../../worker/WorkerFlow.js';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.js';
import {copyProperties, deleteProperties, pasteProperties} from '../CopyPaste.js';
import type {DataMap} from '../../util/DataTypes.js';
import type {Block} from '../../block/Block.js';
import {Flow} from '../../block/Flow.js';
import {StaticBlock} from '../../block/StaticBlock.js';

describe('Copy Paste', function () {
  const data = {
    '#is': '',
    'add': {'#is': 'add', '@b-xyw': [100, 100, 100]},
    '#static': {'#is': '', 'subtract': {'#is': 'subtract'}},
  };
  const copy = {
    'add': {'#is': 'add', '@b-xyw': [100, 100, 100]},
    '#static': {subtract: {'#is': 'subtract'}},
  };
  function createWorkerFlow(funcId: string, workerData: DataMap = data): [WorkerFlow, Flow] {
    const libFlow = new Flow();
    libFlow.load({'#is': ''});
    const funcLib = libFlow.getFuncLib();
    WorkerFunctionGen.registerType(
      workerData,
      {id: funcId, name: funcId.substring(1), properties: []},
      undefined,
      funcLib
    );
    const flow = new WorkerFlow();
    flow.load(workerData, funcId, undefined, undefined, undefined, funcLib);
    return [flow, libFlow];
  }

  it('basic', function () {
    const [flow1, libFlow1] = createWorkerFlow(':copy1');

    const copied = copyProperties(flow1, ['add', '#static.subtract']) as DataMap;
    expect(copied).toEqual(copy);

    const [flow2, libFlow2] = createWorkerFlow(':copy2', {'#is': ''});
    expect(pasteProperties(flow2, copied)).toEqual(['add', '#static.subtract']);
    expect(flow2.save()).toEqual({
      '#is': '',
      'add': {'#is': 'add', '@b-xyw': [100, 100, 100]},
      '#static': {
        '#is': '',
        'subtract': {'#is': 'subtract'},
      },
    });
    expect((flow2.getValue('#static') as StaticBlock).save()).toEqual({
      '#is': '',
      'subtract': {'#is': 'subtract'},
    });

    deleteProperties(flow1, ['add', '#static.subtract']);
    expect(flow1.save()).toEqual({'#is': ''});
    expect((flow1.getValue('#static') as StaticBlock).save()).toEqual({'#is': ''});

    flow1.destroy();
    flow2.destroy();
    libFlow1.destroy();
    libFlow2.destroy();
  });

  it('rename', function () {
    const [flow1, libFlow] = createWorkerFlow(':copyRename');

    flow1.createBlock('divide')._load({'#is': 'divide', '~0': '##.add.0', '@b-xyw': 'add'});

    const copied1 = copyProperties(flow1, ['add', 'divide']) as DataMap;
    const copied2 = copyProperties(flow1, ['#static.subtract']) as DataMap;

    pasteProperties(flow1, copied1, 'rename');
    pasteProperties(flow1, copied2, 'rename');

    expect(flow1.save()).toEqual({
      '#is': '',
      '#static': {
        '#is': '',
        'subtract': {'#is': 'subtract'},
        'subtract1': {'#is': 'subtract'},
      },
      'add': {'#is': 'add', '@b-xyw': [100, 100, 100]},
      'divide': {'#is': 'divide', '~0': '##.add.0', '@b-xyw': 'add'},
      'add1': {'#is': 'add', '@b-xyw': [124, 124, 100]},
      'divide1': {'#is': 'divide', '~0': '##.add1.0', '@b-xyw': 'add1'},
    });
    expect((flow1.getValue('#static') as StaticBlock).save()).toEqual({
      '#is': '',
      'subtract': {'#is': 'subtract'},
      'subtract1': {'#is': 'subtract'},
    });

    flow1.destroy();
    libFlow.destroy();
  });

  it('invalid copy paste', function () {
    const flow1 = new WorkerFlow();
    expect(copyProperties(flow1, ['add', '#static.subtract'])).toBe('nothing to copy');
    expect(pasteProperties(flow1, null)).toBe('invalid data');
    expect(pasteProperties(flow1, [] as any)).toBe('invalid data');
    expect(pasteProperties(flow1, 1 as any)).toBe('invalid data');

    const [flow1Loaded, libFlow] = createWorkerFlow(':copyInvalid');
    flow1.destroy();
    expect((pasteProperties(flow1Loaded, copy) as string).startsWith('block already exists: ')).toBe(true);

    expect(pasteProperties(flow1Loaded.getValue('add') as Block, copy)).toBe(
      '#static properties not allowed in this Block'
    );
    flow1Loaded.destroy();
    libFlow.destroy();
  });
});
