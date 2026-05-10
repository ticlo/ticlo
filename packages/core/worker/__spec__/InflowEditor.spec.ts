import {expect} from 'vitest';
import {Flow, FlowLib, Root} from '../../block/Flow.js';
import {FlowEditor} from '../FlowEditor.js';
import {WorkerFunctionGen} from '../WorkerFunctionGen.js';

import type {PropDesc, PropGroupDesc} from '../../block/Descriptor.js';
import type {DataMap} from '../../util/DataTypes.js';
import {SharedBlock} from '../../block/SharedBlock.js';
import {PersistentFunctionLib} from '../../block/NSFunctionLib.js';
import {Namespace} from '../../block/Namespace.js';
import {FunctionLib, globalFunctions} from '../../block/FunctionLib.js';

describe('InflowEditor', function () {
  it('scope path metadata is runtime only', function () {
    const flow = Root.instance.addFlow('InflowEditorScope', {});
    const funcLib = flow.getFuncLib();

    expect(new FunctionLib().getScopePath()).toBeNull();
    expect(globalFunctions.getScopePath()).toBeNull();
    expect(Namespace.getFunctionLib('+InflowEditorScope:test:worker').getScopePath()).toBe('+InflowEditorScope.:test');
    expect(funcLib.getScopePath()).toBe('InflowEditorScope');

    const data = {
      '#is': '',
      'add': {
        '#is': 'add',
      },
    };
    WorkerFunctionGen.registerType(data, {id: ':workerScope', name: 'workerScope'}, undefined, funcLib);

    const editor = FlowEditor.createFromFunction(flow, '#edit-scope', ':workerScope', null);
    expect(editor.getValue('^#lib')).toBe('InflowEditorScope');
    expect(editor.save()).toEqual(data);

    Root.instance.deleteValue('InflowEditorScope');
  });

  it('stores namespace function libraries as namespace flows', function () {
    const data = {'#is': '', 'add': {'#is': 'add'}};
    const lib = Namespace.getFunctionLib('+NsFlowLib:g:a');
    const libFlow = Root.instance.queryValue('+NsFlowLib.:g') as FlowLib;

    expect(libFlow).toBeInstanceOf(FlowLib);
    expect(libFlow.getValue('#is')).toBe('#flow:lib');

    WorkerFunctionGen.registerType(data, {id: '+NsFlowLib:g:a', name: 'a'}, undefined, lib);

    expect(libFlow.save()).toEqual({
      '#is': '',
      '#functions': {
        ':a': {
          type: 'worker',
          worker: data,
        },
      },
    });

    Namespace.delete('+NsFlowLib:g:a');
    Root.instance.deleteValue('+NsFlowLib');
  });

  it('uses : as the flow name for an empty namespace function library name', function () {
    const data = {'#is': '', 'add': {'#is': 'add'}};
    const lib = Namespace.getFunctionLib('+NsFlowLibEmpty::a');
    const libFlow = Root.instance.queryValue('+NsFlowLibEmpty.:') as FlowLib;

    expect(libFlow).toBeInstanceOf(FlowLib);

    WorkerFunctionGen.registerType(data, {id: '+NsFlowLibEmpty::a', name: 'a'}, undefined, lib);

    expect(libFlow.save()['#functions']).toEqual({
      ':a': {
        type: 'worker',
        worker: data,
      },
    });

    Namespace.delete('+NsFlowLibEmpty::a');
    Root.instance.deleteValue('+NsFlowLibEmpty');
  });

  it('createFromField', function () {
    const flow = new Flow();
    flow.load({});
    const funcLib = flow.getFuncLib();
    const block = flow.createBlock('a');
    const data = {
      '#is': '',
      'add': {
        '#is': 'add',
      },
    };

    WorkerFunctionGen.registerType(data, {id: ':func1', name: 'func1'}, undefined, funcLib);

    // editor with map data
    block.setValue('use1', data);
    const inlineEditor = FlowEditor.createFromField(block, '#edit-use1', 'use1');
    expect(inlineEditor.save()).toEqual(data);
    expect(inlineEditor.getFuncLib()).toBe(funcLib);

    // editor with registered in-flow worker function
    block.setValue('use2', ':func1');
    const registeredEditor = FlowEditor.createFromField(block, '#edit-use2', 'use2');
    expect(registeredEditor.save()).toEqual(data);
    expect(registeredEditor.getFuncLib()).toBe(funcLib);
  });

  it('createFromFunction', function () {
    const flow = new Flow();
    flow.load({});
    const funcLib = flow.getFuncLib();
    const data = {
      '#is': '',
      'add': {
        '#is': 'subtract',
      },
    };

    WorkerFunctionGen.registerType(data, {id: ':worker2', name: 'worker2'}, undefined, funcLib);

    const existingEditor = FlowEditor.createFromFunction(flow, '#edit-func', ':worker2', null);
    expect(existingEditor.save()).toEqual(data);
    expect(existingEditor.getFuncLib()).toBe(funcLib);

    const newEditor = FlowEditor.createFromFunction(flow, '#edit-func-default', ':worker2-2', data);
    expect(newEditor.save()).toEqual(data);
    expect(newEditor.getFuncLib()).toBe(funcLib);
  });

  it('applyChange function', function () {
    const flow = new Flow();
    flow.load({});
    const funcLib = flow.getFuncLib();

    const expectedData = {
      '#inputs': {
        '#is': '',
        '#custom': [
          {
            name: 'g',
            type: 'group',
            defaultLen: 2,
            properties: [{name: 'a', type: 'number'}],
          },
          {name: 'a', type: 'number'},
        ],
        '@b-p': ['a'],
      },
      '#is': '',
      '#outputs': {
        '#is': '',
        '#custom': [
          {
            name: 'g',
            type: 'group',
            defaultLen: 2,
            properties: [{name: 'b', type: 'number'}],
          },
          {name: 'b', type: 'number'},
        ],
        '@b-p': ['b'],
      },
      '#desc': {icon: 'fas:plus'},
    };
    const expectedDescProperties: (PropDesc | PropGroupDesc)[] = [
      {
        name: 'g',
        type: 'group',
        defaultLen: 2,
        properties: [
          {name: 'a', type: 'number'},
          {name: 'b', type: 'number', readonly: true},
        ],
      },
      {name: 'a', type: 'number'},
      {name: 'b', type: 'number', readonly: true},
    ];

    WorkerFunctionGen.registerType({'#is': ''}, {id: ':worker3', name: 'worker3', properties: []}, undefined, funcLib);

    const editor = FlowEditor.createFromFunction(flow, '#edit-func', ':worker3', null);
    editor.createBlock('#inputs')._load(expectedData['#inputs']);
    editor.createBlock('#outputs')._load(expectedData['#outputs']);
    editor.setValue('#desc', expectedData['#desc']);
    WorkerFunctionGen.applyChangeToFunc(editor, ':worker3');

    const [desc, workerData, functionLib] = Namespace.getWorker(':worker3', flow);
    expect(workerData).toEqual(expectedData);
    expect(desc.icon).toBe('fas:plus');
    expect(desc.properties).toEqual(expectedDescProperties);
    expect(functionLib).toBeInstanceOf(PersistentFunctionLib);
    expect(functionLib).toBe(funcLib);
  });

  it('shared block', function () {
    const flow = new Flow();
    flow.load({});

    const editor = FlowEditor.createFromFunction(flow, '#edit-func', ':worker4', {
      '#is': '',
      '#shared': {'#is': ''},
    });

    const block: SharedBlock = editor.getValue('#shared') as SharedBlock;
    expect(block).toBeInstanceOf(SharedBlock);
    expect(block._prop).toBe(editor.getProperty('#shared'));

    flow.destroy();
  });
});
