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
import type {FlowStorage} from '../../block/Storage.js';
import '../../functions/math/Arithmetic.js';

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

  it('serializes the in-flow function lib into flow data', function () {
    const data = {'#is': '', 'add': {'#is': 'add'}};
    const flow = new Flow();
    flow.load({});

    WorkerFunctionGen.registerType(data, {id: ':savedWorker', name: 'savedWorker'}, undefined, flow.getFuncLib());

    expect(flow.save()['#functions']).toEqual({
      ':savedWorker': {
        type: 'worker',
        worker: data,
      },
    });
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

  it('saves namespace function libraries through their flow', function () {
    const saved: {key?: string; data?: DataMap; workerSaved?: boolean} = {};
    const storage: FlowStorage = {
      delete() {},
      saveFlow(flow, data, key) {
        saved.key = key;
        saved.data = data;
      },
      async loadFlow() {
        return null;
      },
      saveWorkers() {
        saved.workerSaved = true;
      },
      async loadWorkers() {
        return null;
      },
      init() {},
      getFlowLoader() {
        return {};
      },
    };
    Namespace.setStorage(storage);

    try {
      const data = {'#is': '', 'add': {'#is': 'add'}};
      const lib = Namespace.getFunctionLib('+NsFlowSave:g:a');

      WorkerFunctionGen.registerType(data, {id: '+NsFlowSave:g:a', name: 'a'}, undefined, lib);

      expect(saved.key).toBe('+NsFlowSave.:g');
      expect(saved.data).toEqual({
        '#is': '',
        '#functions': {
          ':a': {
            type: 'worker',
            worker: data,
          },
        },
      });
      expect(saved.workerSaved).not.toBe(true);
    } finally {
      Namespace.delete('+NsFlowSave:g:a');
      Root.instance.deleteValue('+NsFlowSave');
      Namespace.setStorage(undefined as any);
    }
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

  it('runs namespace worker functions from a regular flow', function () {
    const data = {
      '#is': '',
      '#inputs': {'#is': '', '#custom': [{name: 'n', type: 'number'}]},
      '#outputs': {'#is': '', '#custom': [{name: 'result', type: 'number'}], '~result': '##.add.#output'},
      'add': {'#is': 'add', '1': 1, '~0': '##.#inputs.n'},
    };
    const funcId = '+NsFlowRuntime:g:f1';
    const lib = Namespace.getFunctionLib(funcId);

    WorkerFunctionGen.registerType(data, {id: funcId, name: 'f1'}, undefined, lib);

    expect(Namespace.getDescToSend(funcId)[0]?.id).toBe(funcId);

    const flow = Root.instance.addFlow('NsFlowRuntimeUse', {});
    flow.createBlock('calc')._load({'#is': funcId, 'n': 2});
    Root.runAll();

    expect(flow.queryValue('calc.result')).toBe(3);

    Root.instance.deleteValue('NsFlowRuntimeUse');
    Namespace.delete(funcId);
    Root.instance.deleteValue('+NsFlowRuntime');
  });

  it('loads saved namespace function libraries as FlowLibs', function () {
    const worker = {
      '#is': '',
      '#inputs': {'#is': '', '#custom': [{name: 'n', type: 'number'}]},
      '#outputs': {'#is': '', '#custom': [{name: 'result', type: 'number'}], '~result': '##.add.#output'},
      'add': {'#is': 'add', '1': 1, '~0': '##.#inputs.n'},
    };
    const flowData = {
      '#is': '',
      '#functions': {
        ':f1': {
          type: 'worker',
          worker,
        },
      },
    };
    const funcId = '+NsFlowLoad:g:f1';

    const libFlow = Root.instance.addFlow('+NsFlowLoad.:g', flowData, null, true);

    expect(libFlow).toBeInstanceOf(FlowLib);
    expect(Namespace.getAllFunctionIds()).toContain(funcId);
    expect(Namespace.getDescToSend(funcId)[0]?.id).toBe(funcId);

    const flow = Root.instance.addFlow('NsFlowLoadUse', {});
    flow.createBlock('calc')._load({'#is': funcId, 'n': 2});
    Root.runAll();

    expect(flow.queryValue('calc.result')).toBe(3);

    Root.instance.deleteValue('NsFlowLoadUse');
    Namespace.delete(funcId);
    Root.instance.deleteValue('+NsFlowLoad');
  });

  it('resolves local ids inside namespace function libraries', function () {
    const bbWorker = {
      '#is': '',
      '#inputs': {'#is': '', '#custom': [{name: 'n', type: 'number'}]},
      '#outputs': {'#is': '', '#custom': [{name: 'result', type: 'number'}], '~result': '##.add.#output'},
      'add': {'#is': 'add', '1': 1, '~0': '##.#inputs.n'},
    };
    const aaWorker = {
      '#is': '',
      '#inputs': {'#is': '', '#custom': [{name: 'n', type: 'number'}]},
      '#outputs': {'#is': '', '#custom': [{name: 'result', type: 'number'}], '~result': '##.bb.result'},
      'bb': {'#is': ':bb', '~n': '##.#inputs.n'},
    };
    const flowData = {
      '#is': '',
      '#functions': {
        ':aa': {
          type: 'worker',
          worker: aaWorker,
        },
        ':bb': {
          type: 'worker',
          worker: bbWorker,
        },
      },
    };
    const libFlow = Root.instance.addFlow('+NsFlowLocal.:g', flowData, null, true);
    const lib = libFlow.getFuncLib();

    expect(lib.getDescToSend(':aa')[0]?.id).toBe(':aa');
    expect(lib.getDescToSend('+NsFlowLocal:g:aa')[0]?.id).toBe('+NsFlowLocal:g:aa');
    expect(lib.getWorkerData(':aa')).toEqual(aaWorker);
    expect(lib.getWorkerData('+NsFlowLocal:g:aa')).toEqual(aaWorker);

    libFlow.createBlock('calc')._load({'#is': ':aa', 'n': 2});
    Root.runAll();
    expect(libFlow.queryValue('calc.result')).toBe(3);

    const flow = Root.instance.addFlow('NsFlowLocalUse', {});
    flow.createBlock('calc')._load({'#is': '+NsFlowLocal:g:aa', 'n': 2});
    Root.runAll();
    expect(flow.queryValue('calc.result')).toBe(3);
    expect(libFlow.save()['#functions']).toEqual(flowData['#functions']);

    Root.instance.deleteValue('NsFlowLocalUse');
    Namespace.delete('+NsFlowLocal:g:aa');
    Namespace.delete('+NsFlowLocal:g:bb');
    Root.instance.deleteValue('+NsFlowLocal');
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
