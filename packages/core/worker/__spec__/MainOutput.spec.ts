import {expect} from 'vitest';
import {Block} from '../../block/Block.ts';
import {Flow, Root} from '../../block/Flow.ts';
import type {DataMap} from '../../util/DataTypes.ts';
import {FlowEditor} from '../FlowEditor.ts';
import {WorkerFlow} from '../WorkerFlow.ts';

describe('Worker #main output', function () {
  it.each([WorkerFlow, FlowEditor])('adds the binding and descriptor when saving %s', function (FlowClass) {
    const data = {'#is': '', '#main': {'#is': ''}, '#outputs': {'#is': ''}};
    const flow = new FlowClass();
    flow.load(data);

    const saved = flow.save();
    expect(saved['#outputs']).toEqual({
      '#is': '',
      '~#main': '##.#main',
      '#custom': [{name: '#main', type: 'block'}],
    });
    expect(flow.save()).toEqual(saved);
    expect(data['#outputs']).toEqual({'#is': ''});

    const reloaded = new FlowClass();
    reloaded.load(saved);
    expect(reloaded.queryValue('#outputs.#main')).toBe(reloaded.getValue('#main'));
    expect(reloaded.save()).toEqual(saved);
    reloaded.destroy();
    flow.destroy();
    expect(flow.save()).toEqual(saved);
  });

  it('preserves custom properties without duplicating an existing #main descriptor', function () {
    const custom = [
      {name: 'result', type: 'number'},
      {name: '#main', type: 'any', pinned: true},
    ];
    const flow = new WorkerFlow();
    flow.load({'#is': '', '#main': {'#is': ''}, '#outputs': {'#is': '', '#custom': custom, 'result': 17}});

    expect(flow.save()['#outputs']).toEqual({
      '#is': '',
      '#custom': custom,
      'result': 17,
      '~#main': '##.#main',
    });
    expect(custom).toHaveLength(2);

    const remaining = [custom[0]];
    (flow.getValue('#outputs') as Block).setValue('#custom', remaining);
    const saved = flow.save()['#outputs'] as DataMap;
    expect(saved['#custom']).toEqual([...remaining, {name: '#main', type: 'block'}]);
    expect(remaining).toEqual([custom[0]]);
    flow.destroy();
  });

  it.each([{'#main': null}, {'~#main': '##.other'}])('preserves an explicit output %j', function (output) {
    const data = {'#is': '', '#main': {'#is': ''}, '#outputs': {'#is': '', ...output}};
    const flow = new WorkerFlow();
    flow.load(data);
    expect(flow.save()).toEqual(data);
    flow.destroy();
  });

  it.each([
    {'#is': '', '#main': {'#is': ''}},
    {'#is': '', '#outputs': {'#is': ''}},
    {'#is': '', '#main': 'text', '#outputs': {'#is': ''}},
    {'#is': '', '#main': {'#is': {'#is': 'react:div'}}, '#outputs': {'#is': ''}},
    {'#is': '', '#main': {'#is': ''}, '#outputs': {'#is': {'#is': ''}}},
    {'#is': '', 'other': {'#is': ''}, '~#main': 'other', '#outputs': {'#is': ''}},
  ])('requires an owned root Block and an existing output Block: %j', function (data) {
    const flow = new WorkerFlow();
    flow.load(data);
    expect(flow.save()).toEqual(data);
    flow.destroy();
  });

  it('publishes the generated output after saving a named worker', function () {
    const flow = new Flow();
    flow.load({
      '#is': '',
      '#functions': {
        ':component': {
          type: 'worker',
          worker: {'#is': '', '#main': {'#is': ''}, '#outputs': {'#is': ''}},
        },
      },
    });
    const editor = FlowEditor.createFromFunction(flow, '#edit-component', ':component', null);
    const saved = editor.applyChange() as DataMap;
    expect(flow.getFuncLib().getWorkerData(':component')).toEqual(saved);
    expect(flow.getFuncLib().getDescToSend(':component')[0].properties).toEqual([
      {name: '#main', type: 'block', readonly: true},
    ]);

    const instance = flow.createBlock('instance');
    instance.setValue('#is', ':component');
    Root.run();
    const worker = instance.getValue('#worker') as WorkerFlow;
    expect(instance.getValue('#main')).toBeInstanceOf(Block);
    expect(instance.getValue('#main')).toBe(worker.getValue('#main'));
    flow.destroy();
  });
});
