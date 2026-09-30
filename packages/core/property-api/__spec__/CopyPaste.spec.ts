import {expect} from 'vitest';
import '../../functions/math/Arithmetic.ts';
import {WorkerFlow} from '../../worker/WorkerFlow.ts';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.ts';
import {copyProperties, deleteProperties, moveBlocks, pasteProperties} from '../CopyPaste.ts';
import type {DataMap} from '../../util/DataTypes.ts';
import type {Block} from '../../block/Block.ts';
import {Flow} from '../../block/Flow.ts';
import type {StaticBlock} from '../../block/StaticBlock.ts';
import {decode, encode} from '../../util/Serialize.ts';

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
    expect(copied).toEqual({
      ...copy,
      '#_copy_from': flow1.getFullPath(),
      '#static': {...copy['#static'], '#_copy_from': flow1._staticBlock.getFullPath()},
    });

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

  it('adjusts external parent bindings while preserving copied targets and clipboard data', () => {
    const flow = new Flow();
    flow.load({
      value: 10,
      a: {
        '#is': '',
        'own': 20,
        '~input': '##.value',
        '~peer': '##.b.value',
        '~local': 'own',
        '~flow': '#flow.value',
        '~context': '^value',
        'nested': {'#is': '', '~input': '##.##.value', '~own': '##.own', '~peer': '##.##.b.value'},
      },
      b: {'#is': '', 'value': 30},
      container: {'#is': '', 'a': {'#is': ''}, 'b': {'#is': ''}},
    });
    const copied = copyProperties(flow, ['a', 'b']) as DataMap;
    const clipboard = encode(copied);
    const target = flow.getValue('container') as Block;
    expect(pasteProperties(target, decode(clipboard) as DataMap, 'rename')).toEqual(['a1', 'b1']);
    expect(target.queryProperty('a1.input')._bindingPath).toBe('##.##.value');
    expect(target.queryValue('a1.input')).toBe(10);
    expect(target.queryProperty('a1.peer')._bindingPath).toBe('##.b1.value');
    expect(target.queryValue('a1.peer')).toBe(30);
    expect(target.queryProperty('a1.local')._bindingPath).toBe('own');
    expect(target.queryProperty('a1.flow')._bindingPath).toBe('#flow.value');
    expect(target.queryProperty('a1.context')._bindingPath).toBe('^value');
    expect(target.queryProperty('a1.nested.input')._bindingPath).toBe('##.##.##.value');
    expect(target.queryProperty('a1.nested.own')._bindingPath).toBe('##.own');
    expect(target.queryProperty('a1.nested.peer')._bindingPath).toBe('##.##.b1.value');
    expect(pasteProperties(target, copied, 'rename')).toEqual(['a2', 'b2']);
    expect(encode(copied)).toBe(clipboard);
    expect(target.queryProperty('a2.nested.input')._bindingPath).toBe('##.##.##.value');
    expect(target.getProperty('#_copy_from', false)).toBeNull();
    flow.destroy();
  });

  it('reduces parent prefixes only when the same ancestor can still be reached', () => {
    const flow = new Flow();
    flow.load({
      value: 10,
      source: {
        '#is': '',
        'value': 20,
        '~bound': '##.value',
        'a': {
          '#is': '',
          '~root': '##.##.value',
          '~sibling': '##.value',
          '~parent': '##.##',
          'nested': {'#is': '', '~root': '##.##.##.value', '~sibling': '##.##.value'},
        },
      },
      other: {'#is': '', 'inner': {'#is': ''}},
    });
    const source = flow.getValue('source') as Block;
    const copied = copyProperties(source, ['a']) as DataMap;
    pasteProperties(flow, copied);
    expect(flow.queryProperty('a.root')._bindingPath).toBe('##.value');
    expect(flow.queryValue('a.root')).toBe(10);
    expect(flow.queryProperty('a.sibling')._bindingPath).toBe('##.value');
    expect(flow.queryProperty('a.parent')._bindingPath).toBe('##');
    expect(flow.queryProperty('a.nested.root')._bindingPath).toBe('##.##.value');
    expect(flow.queryProperty('a.nested.sibling')._bindingPath).toBe('##.##.value');
    const other = flow.queryValue('other.inner') as Block;
    pasteProperties(other, copied);
    expect(other.queryProperty('a.root')._bindingPath).toBe('##.##.##.value');
    expect(other.queryProperty('a.sibling')._bindingPath).toBe('##.value');
    pasteProperties(flow, copyProperties(source, ['bound']) as DataMap);
    expect(flow.getProperty('bound')._bindingPath).toBe('value');
    expect(flow.getValue('bound')).toBe(10);
    flow.destroy();
  });

  it('keeps paths unchanged at equal depths, across flows, and without source metadata', () => {
    const flow = new Flow();
    flow.load({
      source: {'#is': '', 'a': {'#is': '', '~input': '##.##.value'}},
      target: {'#is': ''},
    });
    const copied = copyProperties(flow.getValue('source') as Block, ['a']) as DataMap;
    const otherFlow = new Flow();
    otherFlow.load({});
    for (const target of [flow.getValue('target') as Block, otherFlow]) {
      pasteProperties(target, copied);
      expect(target.queryProperty('a.input')._bindingPath).toBe('##.##.value');
    }
    pasteProperties(flow, {a: copied.a});
    expect(flow.queryProperty('a.input')._bindingPath).toBe('##.##.value');
    flow.destroy();
    otherFlow.destroy();
  });

  it('moves blocks without rewriting outside bindings and keeps sources on failed moves', () => {
    const flow = new Flow();
    flow.load({
      'value': 10,
      'a': {'#is': '', '~input': '##.value', '~peer': '##.b.value'},
      'b': {'#is': '', 'value': 20},
      '~outside': 'a.input',
      'target': {'#is': '', 'a': {'#is': ''}},
    });
    const target = flow.getValue('target') as Block;
    const before = flow.save();
    expect(moveBlocks(flow, flow, ['a'])).toBe('source and target parents must be different');
    expect(moveBlocks(flow, flow.getValue('a') as Block, ['a'])).toBe('cannot move blocks into their descendants');
    expect(moveBlocks(flow, target, ['value'])).toBe('invalid block');
    expect(typeof moveBlocks(flow, target, ['a'])).toBe('string');
    expect(flow.save()).toEqual(before);
    expect(moveBlocks(flow, target, ['a', 'b'], 'rename')).toEqual(['b', 'a1']);
    expect(flow.getValue('a')).toBeUndefined();
    expect(flow.getValue('b')).toBeUndefined();
    expect(flow.getProperty('outside')._bindingPath).toBe('a.input');
    expect(target.queryProperty('a1.input')._bindingPath).toBe('##.##.value');
    expect(target.queryValue('a1.peer')).toBe(20);
    flow.destroy();
  });

  it('uses the actual static parent and leaves wrapped values untouched', () => {
    const [worker, lib] = createWorkerFlow(':copyStaticBindings');
    lib.setValue('value', 10);
    const staticBlock = worker._staticBlock;
    const block = staticBlock.createBlock('a');
    block._load({'~input': '##.##.##.value'});
    block.setValue('plain', {'~input': '##.##.##.value', '#is': {'~input': '##.##.##.value'}});
    const target = lib.createBlock('target');
    const copied = copyProperties(staticBlock, ['a']) as DataMap;
    pasteProperties(target, copied);
    expect(target.queryProperty('a.input')._bindingPath).toBe('##.##.value');
    expect(target.queryValue('a.input')).toBe(10);
    expect(target.queryValue('a.plain')).toEqual(block.getValue('plain'));
    const bundled = copyProperties(worker, ['#static.a']) as DataMap;
    pasteProperties(worker, bundled, 'rename');
    expect(staticBlock.getProperty('#_copy_from', false)).toBeNull();
    expect(staticBlock.queryProperty('a1.input')._bindingPath).toBe('##.##.##.value');
    worker.destroy();
    lib.destroy();
  });

  it('can move a block over its old parent after preparing the paste', () => {
    const flow = new Flow();
    flow.load({source: {'#is': '', 'source': {'#is': '', 'value': 10}}});
    const source = flow.getValue('source') as Block;
    expect(moveBlocks(source, flow, ['source'], 'overwrite')).toEqual(['source']);
    expect(flow.queryValue('source.value')).toBe(10);
    expect(flow.queryValue('source.source')).toBeUndefined();
    flow.destroy();
  });
});
