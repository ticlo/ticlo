import {afterEach, describe, expect, it} from 'vitest';
import {Flow, Root} from '../Flow.ts';
import {InputsBlock} from '../FlowIO.ts';
import {DefaultTask} from '../Task.ts';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.ts';
import {Library} from '../Library.ts';
import type {DataMap} from '../../util/DataTypes.ts';

describe('subflow #inputs file-path forwarding', () => {
  const flows: Flow[] = [];
  afterEach(() => {
    for (const flow of flows.reverse()) flow.destroy();
    flows.length = 0;
  });

  function createFlow(library: string, data: DataMap = {'#is': ''}) {
    const flow = new Flow();
    flows.push(flow);
    flow.load(data, null, undefined, undefined, library);
    return flow;
  }

  it('prefixes case 4) file-path inputs when outer and subflow libraries differ', () => {
    const workerData: DataMap = {
      '#is': '',
      '#inputs': {
        '#is': '',
        '#custom': [
          {name: 'file', type: 'file-path'},
          {name: 'text', type: 'string'},
          {name: '#cfgFile', type: 'file-path'},
        ],
      },
      '#outputs': {'#is': '', '~#return': '##.#inputs.file'},
    };
    const outer = createFlow('+proj1');
    const host = outer.createBlock('host');
    host.setValue('file', 'local.txt');
    host.setValue('text', 'plain.txt');
    host.setValue('#cfgFile', 'cfg/a.json');

    const sub = createFlow('+proj2', workerData);
    sub.updateInput(host);

    expect(sub.queryValue('#inputs.file')).toBe('+proj1/local.txt');
    expect(sub.queryValue('#inputs.text')).toBe('plain.txt');
    expect(sub.queryValue('#inputs.#cfgFile')).toBe('+proj1/cfg/a.json');
    expect(sub.save()['#inputs']).not.toHaveProperty('file');

    // Live updates from outer block continue transforming, while cases 1/2/3 and empty stay untouched.
    host.setValue('file', 'https://example.com/a.png');
    expect(sub.queryValue('#inputs.file')).toBe('https://example.com/a.png');

    host.setValue('file', '//cdn.example.com/a.png');
    expect(sub.queryValue('#inputs.file')).toBe('//cdn.example.com/a.png');

    host.setValue('file', '/abs/a.png');
    expect(sub.queryValue('#inputs.file')).toBe('/abs/a.png');

    host.setValue('file', './rel/a.png');
    expect(sub.queryValue('#inputs.file')).toBe('./rel/a.png');

    host.setValue('file', '../parent/a.png');
    expect(sub.queryValue('#inputs.file')).toBe('../parent/a.png');

    host.setValue('file', '+other/a.png');
    expect(sub.queryValue('#inputs.file')).toBe('+other/a.png');

    host.setValue('file', '');
    expect(sub.queryValue('#inputs.file')).toBe('');

    host.setValue('file', 'nested/b.txt');
    expect(sub.queryValue('#inputs.file')).toBe('+proj1/nested/b.txt');
  });

  it('handles #root <-> library, same library, and multi-level worker nesting without double prefixing', () => {
    WorkerFunctionGen.registerType(
      {
        '#is': '',
        '#inputs': {'#is': '', '#custom': [{name: 'file', type: 'file-path'}]},
        '#outputs': {'#is': '', '~#return': '##.#inputs.file'},
      },
      {name: 'leaf'},
      '+projC'
    );
    WorkerFunctionGen.registerType(
      {
        '#is': '',
        '#inputs': {'#is': '', '#custom': [{name: 'file', type: 'file-path'}]},
        'call': {'#is': '+projC::leaf', '~file': '##.#inputs.file'},
        '#outputs': {'#is': '', '~#return': '##.call.#return'},
      },
      {name: 'mid'},
      '+projB'
    );
    try {
      const rootFlow = createFlow('+#root');
      const block = rootFlow.createBlock('callMid');
      block.setValue('#is', '+projB::mid');
      block.setValue('file', 'img.png');
      Root.runAll();

      const midWorker = block.getValue('#worker') as Flow;
      expect(midWorker.queryValue('#inputs.file')).toBe('+#root/img.png');
      const leafWorker = midWorker.queryValue('call.#worker') as Flow;
      expect(leafWorker.queryValue('#inputs.file')).toBe('+#root/img.png');

      // Same library does not add prefix at mid level, then adds +projB when entering +projC.
      const sameFlow = createFlow('+projB');
      const sameBlock = sameFlow.createBlock('callMid');
      sameBlock.setValue('#is', '+projB::mid');
      sameBlock.setValue('file', 'local.png');
      Root.runAll();

      const sameMid = sameBlock.getValue('#worker') as Flow;
      expect(sameMid.queryValue('#inputs.file')).toBe('local.png');
      const sameLeaf = sameMid.queryValue('call.#worker') as Flow;
      expect(sameLeaf.queryValue('#inputs.file')).toBe('+projB/local.png');
    } finally {
      Library.delete('+projC::leaf');
      Library.delete('+projB::mid');
    }
  });

  it('transforms DataMap and Task inputs via parent flow library and preserves local setValue', () => {
    const outer = createFlow('+projA');
    const host = outer.createBlock('mapHost');
    const sub = host.createOutputFlow(Flow, 'child', {
      '#is': '',
      '#inputs': {'#is': '', '#custom': [{name: 'file', type: 'file-path'}]},
    });
    // Override subflow library to differ from outer (+projA).
    sub._library = '+projB';

    sub.updateInput({file: 'data.csv'});
    expect(sub.queryValue('#inputs.file')).toBe('+projA/data.csv');

    sub.updateInput(new DefaultTask({file: 'task.csv'}));
    expect(sub.queryValue('#inputs.file')).toBe('+projA/task.csv');

    // Local setValue on #inputs must not be prefixed.
    const inputs = sub.getValue('#inputs') as InputsBlock;
    inputs.setValue('file', 'own.csv');
    expect(inputs.getValue('file')).toBe('own.csv');
  });

  it('handles #main bound before #inputs and live #custom updates', () => {
    const outer = createFlow('+proj1');
    const host = outer.createBlock('host');
    host.setValue('file', 'doc.txt');

    // Intentionally place #main before #inputs in the map.
    const sub = createFlow('+proj2', {
      '#is': '',
      '#main': {'#is': '', '~src': '##.#inputs.file'},
      '#inputs': {'#is': '', '#custom': [{name: 'file', type: 'file-path'}]},
    });
    sub.updateInput(host);
    expect(sub.queryValue('#main.src')).toBe('+proj1/doc.txt');

    // Changing #custom type between string and file-path refreshes bound input.
    const inputs = sub.getValue('#inputs') as InputsBlock;
    inputs.setValue('#custom', [{name: 'file', type: 'string'}]);
    expect(sub.queryValue('#main.src')).toBe('doc.txt');

    inputs.setValue('#custom', [{name: 'file', type: 'file-path'}]);
    expect(sub.queryValue('#main.src')).toBe('+proj1/doc.txt');
  });
});
