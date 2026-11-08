import {expect} from 'vitest';
import {FlowWithStatic, StaticBlock} from '../StaticBlock.ts';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.ts';
import {WorkerFlow} from '../../worker/WorkerFlow.ts';
import {Flow} from '../Flow.ts';
import {encodeTicloName} from '../../util/Name.ts';
import {Block} from '../Block.ts';

describe('StaticBlock', function () {
  it('does not support inline worker flows', function () {
    const data = {'#is': '', '#static': {'#is': ''}};

    const flow1 = new FlowWithStatic();
    flow1.load(data);
    expect(flow1.getValue('#static')).not.toBeDefined();
    expect(flow1.save()).toEqual({'#is': ''});

    flow1.destroy();
  });

  it('keeps named worker static blocks in the function module flow', function () {
    const data = {'#is': '', '#static': {'#is': ''}};
    const moduleFlow = new Flow();
    moduleFlow.load({'#is': ''});
    const funcModule = moduleFlow.getFuncModule();
    WorkerFunctionGen.registerType(
      data,
      {id: ':staticWorker', name: 'staticWorker', properties: []},
      undefined,
      funcModule
    );

    const flow1 = new WorkerFlow();
    flow1.load(data, ':staticWorker', undefined, undefined, undefined, funcModule);
    const staticBlock: StaticBlock = flow1.getValue('#static') as StaticBlock;
    const sharedRoot = moduleFlow.getValue('#shared') as Block;
    expect(sharedRoot).toBeInstanceOf(Block);
    expect(sharedRoot.getValue('#is')).toBe('flow:const');
    expect(staticBlock).toBeInstanceOf(StaticBlock);
    expect(staticBlock.getValue('#is')).toBe('flow:static');
    expect(staticBlock._prop._block).toBe(sharedRoot);
    expect(staticBlock._prop._name).toBe(encodeTicloName(':staticWorker'));

    const flow2 = new WorkerFlow();
    flow2.load(data, ':staticWorker', undefined, undefined, undefined, funcModule);
    expect(flow2.getValue('#static')).toBe(staticBlock);

    flow1.destroy();
    expect(staticBlock._destroyed).toBe(false);
    flow2.destroy();
    expect(staticBlock._destroyed).toBe(false);

    funcModule.delete(':staticWorker');
    expect(staticBlock._prop.getValue()).not.toBeDefined();
    moduleFlow.destroy();
  });

  it('serializes function static content without serializing the module shared root', function () {
    const data = {'#is': '', '#static': {'#is': ''}};
    const moduleFlow = new Flow();
    moduleFlow.load({'#is': ''});
    const funcModule = moduleFlow.getFuncModule();
    WorkerFunctionGen.registerType(
      data,
      {id: ':saveLoadWorker', name: 'saveLoadWorker', properties: []},
      undefined,
      funcModule
    );

    const flow = new WorkerFlow();
    flow.load(data, ':saveLoadWorker', undefined, undefined, undefined, funcModule);
    const staticBlock: StaticBlock = flow.getValue('#static') as StaticBlock;
    const staticProp = staticBlock._prop;
    staticBlock.setValue('v', 1);
    staticBlock.setValue('#custom', [{name: 'v', type: 'string'}]);

    const saved = flow.save();
    expect(saved).toEqual({'#is': '', '#static': {'#is': '', 'v': 1, '#custom': [{name: 'v', type: 'string'}]}});

    const savedModuleFlow = new Flow();
    savedModuleFlow.load({'#is': ''});
    WorkerFunctionGen.registerType(
      saved,
      {id: ':savedStaticWorker', name: 'savedStaticWorker', properties: []},
      undefined,
      savedModuleFlow.getFuncModule()
    );
    const moduleSaved = savedModuleFlow.save();
    expect(moduleSaved['#shared']).not.toBeDefined();
    expect(moduleSaved).toEqual({
      '#is': '',
      '#functions': {':savedStaticWorker': {type: 'worker', worker: saved}},
    });
    savedModuleFlow.destroy();

    staticBlock.setValue('v', 2);

    flow.liveUpdate(saved);
    expect(staticBlock.getValue('v')).toBe(1);

    flow.liveUpdate({'#is': ''});
    expect(staticBlock.getValue('v')).not.toBeDefined();
    expect(flow.save()).toEqual({'#is': ''});

    flow.destroy();
    expect(staticProp.getValue()).toBe(staticBlock);
    funcModule.delete(':saveLoadWorker');
    expect(staticProp.getValue()).not.toBeDefined();
    moduleFlow.destroy();
  });

  it('cacheMode', function () {
    const data = {'#is': '', '#static': {'#is': '', '#cacheMode': 'persist'}};
    const moduleFlow = new Flow();
    moduleFlow.load({'#is': ''});
    const funcModule = moduleFlow.getFuncModule();
    WorkerFunctionGen.registerType(
      data,
      {id: ':cacheModeWorker1', name: 'cacheModeWorker1', properties: []},
      undefined,
      funcModule
    );

    const flow = new WorkerFlow();
    flow.load(data, ':cacheModeWorker1', undefined, undefined, undefined, funcModule);
    expect(flow.save()).toEqual(data);

    const staticBlock: StaticBlock = flow.getValue('#static') as StaticBlock;
    expect(staticBlock).toBeInstanceOf(StaticBlock);
    const staticProp = staticBlock._prop;

    expect(flow.save()).toEqual(data);

    flow.destroy();
    expect(staticProp.getValue()).toBe(staticBlock);

    // destroy persisted StaticBlock only when function is destroyed
    funcModule.delete(':cacheModeWorker1');
    expect(staticProp.getValue()).not.toBeDefined();
    moduleFlow.destroy();
  });
});
