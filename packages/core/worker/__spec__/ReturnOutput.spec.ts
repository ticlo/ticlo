import {expect} from 'vitest';
import {Block} from '../../block/Block.ts';
import {Flow, Root} from '../../block/Flow.ts';
import {defaultConfigs, getDefaultFuncData, mapConfigDesc, type FunctionDesc} from '../../block/Descriptor.ts';
import type {DataMap} from '../../util/DataTypes.ts';
import {FlowEditor} from '../FlowEditor.ts';
import {WorkerFlow} from '../WorkerFlow.ts';
import {WorkerFunctionGen} from '../WorkerFunctionGen.ts';
import '../MultiWorkerFunction.ts';

describe('Worker #return output', function () {
  it('does not add an output when saving a regular flow', function () {
    const data = {'#is': '', '#main': {'#is': ''}, '#outputs': {'#is': ''}};
    const flow = new Flow();
    flow.load(data);
    expect(flow.save()).toEqual(data);
    flow.destroy();
  });

  it.each([WorkerFlow, FlowEditor])('binds the component root to #return when saving %s', function (FlowClass) {
    const data = {'#is': '', '#main': {'#is': ''}, '#outputs': {'#is': ''}};
    const flow = new FlowClass();
    flow.load(data);

    const saved = flow.save();
    expect(saved['#outputs']).toEqual({
      '#is': '',
      '~#return': '##.#main',
    });
    expect(flow.save()).toEqual(saved);
    expect(data['#outputs']).toEqual({'#is': ''});

    const reloaded = new FlowClass();
    reloaded.load(saved);
    expect(reloaded.queryValue('#outputs.#return')).toBe(reloaded.getValue('#main'));
    expect(reloaded.save()).toEqual(saved);
    reloaded.destroy();
    flow.destroy();
    expect(flow.save()).toEqual(saved);
  });

  it.each([{'#return': null}, {'#return': 0}, {'~#return': '##.other'}])(
    'preserves an explicit return %j',
    function (output) {
      const data = {'#is': '', '#main': {'#is': ''}, '#outputs': {'#is': '', ...output}};
      const flow = new WorkerFlow();
      flow.load(data);
      expect(flow.save()).toEqual(data);
      flow.destroy();
    }
  );

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
    const desc = flow.getFuncLib().getDescToSend(':component')[0];
    expect(desc.properties).toEqual([]);
    expect(desc.configs).toEqual([...defaultConfigs, {name: '#return', type: 'any', readonly: true}]);

    const instance = flow.createBlock('instance');
    instance.setValue('#is', ':component');
    Root.run();
    const worker = instance.getValue('#worker') as WorkerFlow;
    expect(instance.getValue('#return')).toBeInstanceOf(Block);
    expect(instance.getValue('#return')).toBe(worker.getValue('#main'));
    flow.destroy();
  });

  it('exposes #return and #order as configs while retaining ordinary properties and custom configs', function () {
    const data = {
      '#desc': {configs: ['#disabled', '#order', {name: '#custom-config', type: 'number'}]},
      '#inputs': {
        '#custom': [
          {name: '#order', type: 'array', readonly: true, pinned: true},
          {name: 'label', type: 'string'},
        ],
      },
      '#outputs': {
        '#custom': [
          {name: '#return', type: 'block'},
          {name: '#output', type: 'any'},
        ],
      },
    };
    const desc = WorkerFunctionGen.collectDesc(':component', data);
    expect(desc.properties).toEqual([
      {name: 'label', type: 'string'},
      {name: '#output', type: 'any', readonly: true},
    ]);
    expect(desc.configs).toEqual([
      '#disabled',
      {name: '#order', type: 'array', pinned: true},
      {name: '#custom-config', type: 'number'},
      {name: '#return', type: 'block', readonly: true},
    ]);
    expect(mapConfigDesc(desc.configs).map((config) => config.name)).toEqual([
      '#disabled',
      '#order',
      '#custom-config',
      '#return',
    ]);
    expect(data['#desc'].configs[1]).toBe('#order');
    expect(data['#inputs']['#custom'][0].readonly).toBe(true);
  });

  it('returns live component Blocks directly from multi-worker', function () {
    const flow = new Flow();
    flow.load({
      '#functions': {
        ':component': {
          type: 'worker',
          worker: {'#is': '', '#main': {'#is': ''}, '#outputs': {'#is': '', '~#return': '##.#main'}},
        },
      },
      'repeat': {'#is': 'multi-worker', 'input': [{}, {}], 'use': ':component'},
    });
    Root.run();
    const repeat = flow.getValue('repeat') as Block;
    const result = repeat.getValue('#output') as Block[];
    expect(result).toEqual([repeat.queryValue('#workers.0.#main'), repeat.queryValue('#workers.1.#main')]);
    expect(result.every((block) => block instanceof Block && !block.isDestroyed())).toBe(true);
    flow.destroy();
  });

  it.each([
    {name: 'saved style', inputs: {'#is': '', 'style': {width: 0, height: '50%', left: 10}}},
    {name: 'bound style', inputs: {'#is': '', '~style': '##.styleSource'}},
    {
      name: 'bound dimensions',
      inputs: {'#is': '', 'style': {'#is': '', '~width': '##.##.width', '~height': '##.##.height'}},
    },
    {name: 'runtime style', inputs: {'#is': ''}},
    {name: 'object input', inputs: undefined},
  ])('saves resolved dimensions from $name as component initial style', function ({name, inputs}) {
    const flow = new Flow();
    const functionLib = flow.getFuncLib();
    functionLib.addFactory(null, {id: ':view', name: 'view', tags: ['react-comp']});
    const originalDesc = {init: {label: 'keep', style: {width: 99, height: 99, color: 'red'}}};
    WorkerFunctionGen.registerType(
      {'#is': '', '#desc': originalDesc, '#inputs': inputs, '#main': {'#is': ':view'}, '#outputs': {'#is': ''}},
      {id: ':component', name: 'component'},
      undefined,
      functionLib
    );
    const editor = FlowEditor.createFromFunction(flow, '#edit-component', ':component', null);
    const style = {width: 0, height: '50%', left: 10};
    editor.setValue('styleSource', style);
    editor.setValue('width', style.width);
    editor.setValue('height', style.height);
    if (name === 'runtime style') (editor.getValue('#inputs') as Block).updateValue('style', style);
    else if (name === 'object input') editor.updateInput({style});

    const saved = editor.applyChange() as DataMap;
    const expectedInit = {label: 'keep', style: {width: 0, height: '50%', color: 'red'}};
    expect((saved['#desc'] as FunctionDesc).init).toEqual(expectedInit);
    const desc = functionLib.getDescToSend(':component')[0];
    expect(desc.init).toEqual(expectedInit);
    expect(getDefaultFuncData(desc).style).toEqual(expectedInit.style);
    expect(editor.getValue('#desc')).toEqual(originalDesc);
    expect(originalDesc.init.style).toEqual({width: 99, height: 99, color: 'red'});

    const reloaded = new Flow();
    reloaded.load(flow.save());
    expect(reloaded.getFuncLib().getDescToSend(':component')[0].init).toEqual(expectedInit);
    reloaded.destroy();
    flow.destroy();
  });

  it.each([
    {tags: ['other'], style: {width: 100, height: 200}},
    {tags: ['react-comp'], style: {width: 100}},
    {tags: ['react-comp'], style: {height: 200}},
    {tags: ['react-comp'], style: null},
  ])('preserves existing initial style without a component and both dimensions: %j', function ({tags, style}) {
    const flow = new Flow();
    const init = {style: {width: 10, height: 20}};
    WorkerFunctionGen.registerType(
      {'#is': '', '#desc': {tags, init}, '#inputs': {'#is': '', style}},
      {id: ':component', name: 'component'},
      undefined,
      flow.getFuncLib()
    );
    const editor = FlowEditor.createFromFunction(flow, '#edit-component', ':component', null);
    const saved = editor.applyChange() as DataMap;
    expect((saved['#desc'] as FunctionDesc).init).toEqual(init);
    flow.destroy();
  });

  it.each([
    {'#is': '', 'view': {'#is': ':view'}, '#outputs': {'#is': '', '~#return': '##.view'}},
    {'#is': '', '#main': {'#is': ':view'}, '#outputs': {'#is': ''}},
  ])('inherits allowed tags from the #return binding source when saving %j', function (data) {
    const flow = new Flow();
    const functionLib = flow.getFuncLib();
    functionLib.addFactory(null, {
      id: ':view',
      name: 'view',
      tags: ['react-comp', 'other'],
      childrenTags: ['react-comp'],
    });
    WorkerFunctionGen.registerType(data, {id: ':component', name: 'component'}, undefined, functionLib);
    const editor = FlowEditor.createFromFunction(flow, '#edit-component', ':component', null);

    const saved = editor.applyChange() as DataMap;
    expect(saved['#desc']).toEqual({tags: ['react-comp']});
    expect(functionLib.getDescToSend(':component')[0].tags).toEqual(['react-comp']);
    expect(functionLib.getWorkerData(':component')).toEqual(saved);

    editor.setValue('#desc', {icon: 'test', tags: ['custom']});
    const savedDesc = (editor.applyChange() as DataMap)['#desc'];
    expect(savedDesc).toEqual({icon: 'test', tags: ['custom', 'react-comp']});
    expect(editor.getValue('#desc')).toEqual({icon: 'test', tags: ['custom']});

    editor.setValue('#desc', savedDesc);
    expect((editor.applyChange() as DataMap)['#desc']).toEqual(savedDesc);

    const reloaded = new Flow();
    reloaded.load(flow.save());
    expect(reloaded.getFuncLib().getDescToSend(':component')[0].tags).toEqual(['custom', 'react-comp']);
    reloaded.destroy();
    flow.destroy();
  });

  it.each([
    {inputs: {'#is': '', '#custom': [{name: '#order', type: 'array'}]}, expected: ['react-comp', 'custom-child']},
    {inputs: {'#is': '', '#custom': [{name: 'order', type: 'array'}]}, expected: ['existing']},
    {inputs: {'#is': '', '#order': []}, expected: ['existing']},
  ])('copies childrenTags only for a declared #order input: %j', function ({inputs, expected}) {
    const flow = new Flow();
    const functionLib = flow.getFuncLib();
    functionLib.addFactory(null, {
      id: ':view',
      name: 'view',
      tags: ['react-comp'],
      childrenTags: ['react-comp', 'custom-child'],
    });
    WorkerFunctionGen.registerType(
      {
        '#is': '',
        '#desc': {tags: ['custom'], childrenTags: ['existing']},
        '#inputs': inputs,
        '#main': {'#is': ':view'},
        '#outputs': {'#is': ''},
      },
      {id: ':component', name: 'component'},
      undefined,
      functionLib
    );
    const editor = FlowEditor.createFromFunction(flow, '#edit-component', ':component', null);

    const saved = editor.applyChange() as DataMap;
    expect(saved['#desc']).toEqual({tags: ['custom', 'react-comp'], childrenTags: expected});
    expect(functionLib.getDescToSend(':component')[0].childrenTags).toEqual(expected);
    expect(functionLib.getWorkerData(':component')).toEqual(saved);
    expect(editor.getValue('#desc')).toEqual({tags: ['custom'], childrenTags: ['existing']});

    const reloaded = new Flow();
    reloaded.load(flow.save());
    expect(reloaded.getFuncLib().getDescToSend(':component')[0].childrenTags).toEqual(expected);
    reloaded.destroy();
    flow.destroy();
  });

  it.each([
    {'#is': '', 'view': {'#is': ':view'}, '#outputs': {'#is': '', '#return': null}},
    {'#is': '', 'view': {'#is': ':view'}, '#outputs': {'#is': '', '~#return': '##.missing'}},
    {'#is': '', 'view': {'#is': ':view'}, '#outputs': {'#is': '', '~#return': '##.view.result'}},
    {'#is': '', 'view': {'#is': ':view'}, '~alias': 'view', '#outputs': {'#is': '', '~#return': '##.alias'}},
    {'#is': '', 'view': {'#is': ':plain'}, '#outputs': {'#is': '', '~#return': '##.view'}},
  ])('requires a direct #return binding to a block with an allowed tag: %j', function (data: DataMap) {
    data['#inputs'] = {'#is': '', '#custom': [{name: '#order', type: 'array'}]};
    const flow = new Flow();
    const functionLib = flow.getFuncLib();
    functionLib.addFactory(null, {id: ':view', name: 'view', tags: ['react-comp'], childrenTags: ['react-comp']});
    functionLib.addFactory(null, {id: ':plain', name: 'plain', tags: ['other'], childrenTags: ['react-comp']});
    WorkerFunctionGen.registerType(data, {id: ':component', name: 'component'}, undefined, functionLib);
    const editor = FlowEditor.createFromFunction(flow, '#edit-component', ':component', null);

    expect(editor.applyChange()).toEqual(data);
    expect(functionLib.getDescToSend(':component')[0].tags).toBeUndefined();
    flow.destroy();
  });
});
