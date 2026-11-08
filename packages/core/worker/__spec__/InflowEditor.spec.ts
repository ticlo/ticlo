import {expect} from 'vitest';
import {Flow, FlowModule, Root} from '../../block/Flow.ts';
import {FlowEditor} from '../FlowEditor.ts';
import {WorkerFunctionGen} from '../WorkerFunctionGen.ts';

import type {PropDesc, PropGroupDesc} from '../../block/Descriptor.ts';
import type {DataMap} from '../../util/DataTypes.ts';
import {StaticBlock} from '../../block/StaticBlock.ts';
import {FlowFunctionModule} from '../../block/LibraryFunctionModule.ts';
import {Library} from '../../block/Library.ts';
import {encodeTicloName} from '../../util/Name.ts';
import type {FlowStorage} from '../../block/Storage.ts';
import '../../functions/math/Arithmetic.ts';

describe('InflowEditor', function () {
  it('scope path metadata is runtime only', function () {
    const flow = Root.instance.addFlow('InflowEditorScope', {});
    const funcModule = flow.getFuncModule();

    expect(funcModule.flow).toBe(flow);

    const data = {
      '#is': '',
      'add': {
        '#is': 'add',
      },
    };
    WorkerFunctionGen.registerType(data, {id: ':workerScope', name: 'workerScope'}, undefined, funcModule);

    const editor = FlowEditor.createFromFunction(flow, '#edit-scope', ':workerScope', null);
    expect(editor.getValue('#module')).toBe(flow);
    expect(editor.save()).toEqual(data);

    Root.instance.deleteValue('InflowEditorScope');
  });

  it('serializes the in-flow function module into flow data', function () {
    const data = {'#is': '', 'add': {'#is': 'add'}};
    const flow = new Flow();
    flow.load({});

    WorkerFunctionGen.registerType(data, {id: ':savedWorker', name: 'savedWorker'}, undefined, flow.getFuncModule());

    expect(flow.save()['#functions']).toEqual({
      ':savedWorker': {
        type: 'worker',
        worker: data,
      },
    });
  });

  it('tracks history when saving in-flow functions', function () {
    const data = {'#is': '', 'add': {'#is': 'add'}};
    const flow = new Flow();
    flow.load({}, null, (flow) => flow.save());
    flow.startHistory();

    WorkerFunctionGen.registerType(
      data,
      {id: ':trackedWorker', name: 'trackedWorker'},
      undefined,
      flow.getFuncModule()
    );

    expect(flow.getValue('@has-change')).toBe(true);
    expect(flow.getValue('@has-undo')).toBe(true);
    expect(flow.save()['#functions']).toEqual({
      ':trackedWorker': {
        type: 'worker',
        worker: data,
      },
    });

    flow.undo();

    expect(flow.getValue('@has-change')).not.toBeDefined();
    expect(flow.getValue('@has-redo')).toBe(true);
    expect(flow.save()['#functions']).not.toBeDefined();

    flow.redo();

    expect(flow.getValue('@has-change')).toBe(true);
    expect(flow.save()['#functions']).toEqual({
      ':trackedWorker': {
        type: 'worker',
        worker: data,
      },
    });
  });

  it('stores library function modules as library flows', function () {
    const data = {'#is': '', 'add': {'#is': 'add'}};
    const module = Library.getFunctionModule('+LibraryFlowModule:g:a');
    const moduleFlow = Root.instance.queryValue('+LibraryFlowModule.:g') as FlowModule;

    expect(moduleFlow).toBeInstanceOf(FlowModule);
    expect(module.flow).toBe(moduleFlow);
    expect(moduleFlow.getValue('#is')).toBe('flow:module');

    WorkerFunctionGen.registerType(data, {id: '+LibraryFlowModule:g:a', name: 'a'}, undefined, module);

    expect(moduleFlow.save()).toEqual({
      '#is': '',
      '#functions': {
        ':a': {
          type: 'worker',
          worker: data,
        },
      },
    });

    Library.delete('+LibraryFlowModule:g:a');
    Root.instance.deleteValue('+LibraryFlowModule');
  });

  it('saves library function modules through module storage', async function () {
    const saved: {libraryId?: string; module?: string; data?: DataMap; flowSaved?: boolean} = {};
    const storage: FlowStorage = {
      delete() {},
      saveFlow() {
        saved.flowSaved = true;
      },
      async loadFlow() {
        return null;
      },
      saveModule(libraryId, module, data) {
        saved.libraryId = libraryId;
        saved.module = module;
        saved.data = data;
      },
      async loadModule() {
        return null;
      },
      init() {},
      getFlowLoader() {
        return {};
      },
    };
    const root = new Root();
    await root.setStorage(storage);

    try {
      const data = {'#is': '', 'add': {'#is': 'add'}};
      const module = Library.getFunctionModule('+LibraryFlowSave:g:a', root);

      WorkerFunctionGen.registerType(data, {id: '+LibraryFlowSave:g:a', name: 'a'}, undefined, module);

      expect(saved.libraryId).toBe('+LibraryFlowSave');
      expect(saved.module).toBe('g');
      expect(saved.data).toEqual({
        '#is': '',
        '#functions': {
          ':a': {
            type: 'worker',
            worker: data,
          },
        },
      });
      expect(saved.flowSaved).not.toBe(true);
    } finally {
      root.destroy();
    }
  });

  it('loads library function modules from full flow data', async function () {
    const data = {'#is': '', 'add': {'#is': 'add'}};
    const flowData = {
      '#is': '',
      '#functions': {
        ':a': {
          type: 'worker',
          worker: data,
        },
      },
    };
    const storage: FlowStorage = {
      delete() {},
      saveFlow() {},
      async loadFlow() {
        return null;
      },
      saveModule() {},
      async loadModule(libraryId, module) {
        if (libraryId === '+LibraryFlowLoadStorage' && module === 'g') {
          return flowData;
        }
        return null;
      },
      init() {},
      getFlowLoader() {
        return {};
      },
    };
    const root = new Root();
    await root.setStorage(storage);

    try {
      await root.enableLibrary('LibraryFlowLoadStorage');
      const module = Library.getFunctionModule('+LibraryFlowLoadStorage:g:a', root);
      await root.loadFlow({library: 'LibraryFlowLoadStorage', kind: 'module', name: 'g'});

      expect(module.getWorkerData('+LibraryFlowLoadStorage:g:a')).toEqual(data);
      expect((root.queryValue('+LibraryFlowLoadStorage.:g') as FlowModule).save()).toEqual(flowData);
    } finally {
      await root.stop({discardChanges: true});
      root.destroy();
    }
  });

  it('uses : as the flow name for an empty library function module name', function () {
    const data = {'#is': '', 'add': {'#is': 'add'}};
    const module = Library.getFunctionModule('+LibraryFlowModuleEmpty::a');
    const moduleFlow = Root.instance.queryValue('+LibraryFlowModuleEmpty.:') as FlowModule;

    expect(moduleFlow).toBeInstanceOf(FlowModule);

    WorkerFunctionGen.registerType(data, {id: '+LibraryFlowModuleEmpty::a', name: 'a'}, undefined, module);

    expect(moduleFlow.save()['#functions']).toEqual({
      ':a': {
        type: 'worker',
        worker: data,
      },
    });

    Library.delete('+LibraryFlowModuleEmpty::a');
    Root.instance.deleteValue('+LibraryFlowModuleEmpty');
  });

  it('runs library worker functions from a regular flow', function () {
    const data = {
      '#is': '',
      '#inputs': {'#is': '', '#custom': [{name: 'n', type: 'number'}]},
      '#outputs': {'#is': '', '#custom': [{name: 'result', type: 'number'}], '~result': '##.add.#output'},
      'add': {'#is': 'add', '1': 1, '~0': '##.#inputs.n'},
    };
    const funcId = '+LibraryFlowRuntime:g:f1';
    const module = Library.getFunctionModule(funcId);

    WorkerFunctionGen.registerType(data, {id: funcId, name: 'f1'}, undefined, module);

    expect(Library.getDescToSend(funcId)[0]?.id).toBe(funcId);

    const flow = Root.instance.addFlow('LibraryFlowRuntimeUse', {});
    flow.createBlock('calc')._load({'#is': funcId, 'n': 2});
    Root.runAll();

    expect(flow.queryValue('calc.result')).toBe(3);

    Root.instance.deleteValue('LibraryFlowRuntimeUse');
    Library.delete(funcId);
    Root.instance.deleteValue('+LibraryFlowRuntime');
  });

  it('loads saved library function modules as FlowModules', function () {
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
    const funcId = '+LibraryFlowLoad:g:f1';

    const moduleFlow = Root.instance.addFlow('+LibraryFlowLoad.:g', flowData, null, true);

    expect(moduleFlow).toBeInstanceOf(FlowModule);
    expect(Library.getAllFunctionIds()).toContain(funcId);
    expect(Library.getDescToSend(funcId)[0]?.id).toBe(funcId);

    const flow = Root.instance.addFlow('LibraryFlowLoadUse', {});
    flow.createBlock('calc')._load({'#is': funcId, 'n': 2});
    Root.runAll();

    expect(flow.queryValue('calc.result')).toBe(3);

    Root.instance.deleteValue('LibraryFlowLoadUse');
    Library.delete(funcId);
    Root.instance.deleteValue('+LibraryFlowLoad');
  });

  it('resolves local ids inside library function modules', function () {
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
    const moduleFlow = Root.instance.addFlow('+LibraryFlowLocal.:g', flowData, null, true);
    const module = moduleFlow.getFuncModule();

    expect(module.getDescToSend(':aa')[0]?.id).toBe(':aa');
    expect(module.getDescToSend('+LibraryFlowLocal:g:aa')[0]?.id).toBe('+LibraryFlowLocal:g:aa');
    expect(module.getWorkerData(':aa')).toEqual(aaWorker);
    expect(module.getWorkerData('+LibraryFlowLocal:g:aa')).toEqual(aaWorker);

    moduleFlow.createBlock('calc')._load({'#is': ':aa', 'n': 2});
    Root.runAll();
    expect(moduleFlow.queryValue('calc.result')).toBe(3);

    const flow = Root.instance.addFlow('LibraryFlowLocalUse', {});
    flow.createBlock('calc')._load({'#is': '+LibraryFlowLocal:g:aa', 'n': 2});
    Root.runAll();
    expect(flow.queryValue('calc.result')).toBe(3);
    expect(moduleFlow.save()['#functions']).toEqual(flowData['#functions']);

    Root.instance.deleteValue('LibraryFlowLocalUse');
    Library.delete('+LibraryFlowLocal:g:aa');
    Library.delete('+LibraryFlowLocal:g:bb');
    Root.instance.deleteValue('+LibraryFlowLocal');
  });

  it('createFromField', function () {
    const flow = new Flow();
    flow.load({});
    const funcModule = flow.getFuncModule();
    const block = flow.createBlock('a');
    const data = {
      '#is': '',
      'add': {
        '#is': 'add',
      },
    };

    WorkerFunctionGen.registerType(data, {id: ':func1', name: 'func1'}, undefined, funcModule);

    // editor with map data
    block.setValue('use1', data);
    const inlineEditor = FlowEditor.createFromField(block, '#edit-use1', 'use1');
    expect(inlineEditor.save()).toEqual(data);
    expect(inlineEditor.getFuncModule()).toBe(funcModule);

    // editor with registered in-flow worker function
    block.setValue('use2', ':func1');
    const registeredEditor = FlowEditor.createFromField(block, '#edit-use2', 'use2');
    expect(registeredEditor.save()).toEqual(data);
    expect(registeredEditor.getFuncModule()).toBe(funcModule);
  });

  it('createFromFunction', function () {
    const flow = new Flow();
    flow.load({});
    const funcModule = flow.getFuncModule();
    const data = {
      '#is': '',
      'add': {
        '#is': 'subtract',
      },
    };

    WorkerFunctionGen.registerType(data, {id: ':worker2', name: 'worker2'}, undefined, funcModule);

    const existingEditor = FlowEditor.createFromFunction(flow, '#edit-func', ':worker2', null);
    expect(existingEditor.save()).toEqual(data);
    expect(existingEditor.getFuncModule()).toBe(funcModule);

    const newEditor = FlowEditor.createFromFunction(flow, '#edit-func-default', ':worker2-2', data);
    expect(newEditor.save()).toEqual(data);
    expect(newEditor.getFuncModule()).toBe(funcModule);
  });

  it('applyChange function', function () {
    const flow = new Flow();
    flow.load({});
    const funcModule = flow.getFuncModule();

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
      '#desc': {icon: '23:🞥'},
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

    WorkerFunctionGen.registerType(
      {'#is': ''},
      {id: ':worker3', name: 'worker3', properties: []},
      undefined,
      funcModule
    );

    const editor = FlowEditor.createFromFunction(flow, '#edit-func', ':worker3', null);
    editor.createBlock('#inputs')._load(expectedData['#inputs']);
    editor.createBlock('#outputs')._load(expectedData['#outputs']);
    editor.setValue('#desc', expectedData['#desc']);
    WorkerFunctionGen.applyChangeToFunc(editor, ':worker3');

    const [desc, workerData, functionModule] = Library.getWorker(':worker3', flow);
    expect(workerData).toEqual(expectedData);
    expect(desc.icon).toBe('23:🞥');
    expect(desc.properties).toEqual(expectedDescProperties);
    expect(functionModule).toBeInstanceOf(FlowFunctionModule);
    expect(functionModule).toBe(funcModule);
  });

  it('static block', function () {
    const flow = new Flow();
    flow.load({});

    const editor = FlowEditor.createFromFunction(flow, '#edit-func', ':worker4', {
      '#is': '',
      '#static': {'#is': ''},
    });

    const block: StaticBlock = editor.getValue('#static') as StaticBlock;
    expect(block).toBeInstanceOf(StaticBlock);
    expect(block._prop._block).toBe(editor.getFuncModule().flow.getValue('#shared'));
    expect(block._prop._name).toBe(encodeTicloName(':worker4'));

    flow.destroy();
  });
});
