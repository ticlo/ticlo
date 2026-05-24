import {expect} from 'vitest';
import {FlowWithStatic, StaticBlock} from '../StaticBlock.js';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.js';
import {WorkerFlow} from '../../worker/WorkerFlow.js';
import {Flow} from '../Flow.js';
import {encodeTicloName} from '../../util/Name.js';
import {Block} from '../Block.js';

describe('StaticBlock', function () {
  it('does not support inline worker flows', function () {
    const data = {'#is': '', '#static': {'#is': ''}};

    const flow1 = new FlowWithStatic();
    flow1.load(data);
    expect(flow1.getValue('#static')).not.toBeDefined();
    expect(flow1.save()).toEqual({'#is': ''});

    flow1.destroy();
  });

  it('keeps named worker static blocks in the function lib flow', function () {
    const data = {'#is': '', '#static': {'#is': ''}};
    const libFlow = new Flow();
    libFlow.load({'#is': ''});
    const funcLib = libFlow.getFuncLib();
    WorkerFunctionGen.registerType(
      data,
      {id: ':staticWorker', name: 'staticWorker', properties: []},
      undefined,
      funcLib
    );

    const flow1 = new WorkerFlow();
    flow1.load(data, ':staticWorker', undefined, undefined, undefined, funcLib);
    const staticBlock: StaticBlock = flow1.getValue('#static') as StaticBlock;
    const sharedRoot = libFlow.getValue('#shared') as Block;
    expect(sharedRoot).toBeInstanceOf(Block);
    expect(sharedRoot.getValue('#is')).toBe('flow:const');
    expect(staticBlock).toBeInstanceOf(StaticBlock);
    expect(staticBlock.getValue('#is')).toBe('flow:static');
    expect(staticBlock._prop._block).toBe(sharedRoot);
    expect(staticBlock._prop._name).toBe(encodeTicloName(':staticWorker'));

    const flow2 = new WorkerFlow();
    flow2.load(data, ':staticWorker', undefined, undefined, undefined, funcLib);
    expect(flow2.getValue('#static')).toBe(staticBlock);

    flow1.destroy();
    expect(staticBlock._destroyed).toBe(false);
    flow2.destroy();
    expect(staticBlock._destroyed).toBe(false);

    funcLib.delete(':staticWorker');
    expect(staticBlock._prop.getValue()).not.toBeDefined();
    libFlow.destroy();
  });

  it('serializes function static content without serializing the lib shared root', function () {
    const data = {'#is': '', '#static': {'#is': ''}};
    const libFlow = new Flow();
    libFlow.load({'#is': ''});
    const funcLib = libFlow.getFuncLib();
    WorkerFunctionGen.registerType(
      data,
      {id: ':saveLoadWorker', name: 'saveLoadWorker', properties: []},
      undefined,
      funcLib
    );

    const flow = new WorkerFlow();
    flow.load(data, ':saveLoadWorker', undefined, undefined, undefined, funcLib);
    const staticBlock: StaticBlock = flow.getValue('#static') as StaticBlock;
    const staticProp = staticBlock._prop;
    staticBlock.setValue('v', 1);
    staticBlock.setValue('#custom', [{name: 'v', type: 'string'}]);

    const saved = flow.save();
    expect(saved).toEqual({'#is': '', '#static': {'#is': '', 'v': 1, '#custom': [{name: 'v', type: 'string'}]}});

    const savedLibFlow = new Flow();
    savedLibFlow.load({'#is': ''});
    WorkerFunctionGen.registerType(
      saved,
      {id: ':savedStaticWorker', name: 'savedStaticWorker', properties: []},
      undefined,
      savedLibFlow.getFuncLib()
    );
    const libSaved = savedLibFlow.save();
    expect(libSaved['#shared']).not.toBeDefined();
    expect(libSaved).toEqual({
      '#is': '',
      '#functions': {':savedStaticWorker': {type: 'worker', worker: saved}},
    });
    savedLibFlow.destroy();

    staticBlock.setValue('v', 2);

    flow.liveUpdate(saved);
    expect(staticBlock.getValue('v')).toBe(1);

    flow.liveUpdate({'#is': ''});
    expect(staticBlock.getValue('v')).not.toBeDefined();
    expect(flow.save()).toEqual({'#is': ''});

    flow.destroy();
    expect(staticProp.getValue()).toBe(staticBlock);
    funcLib.delete(':saveLoadWorker');
    expect(staticProp.getValue()).not.toBeDefined();
    libFlow.destroy();
  });

  it('cacheMode', function () {
    const data = {'#is': '', '#static': {'#is': '', '#cacheMode': 'persist'}};
    const libFlow = new Flow();
    libFlow.load({'#is': ''});
    const funcLib = libFlow.getFuncLib();
    WorkerFunctionGen.registerType(
      data,
      {id: ':cacheModeWorker1', name: 'cacheModeWorker1', properties: []},
      undefined,
      funcLib
    );

    const flow = new WorkerFlow();
    flow.load(data, ':cacheModeWorker1', undefined, undefined, undefined, funcLib);
    expect(flow.save()).toEqual(data);

    const staticBlock: StaticBlock = flow.getValue('#static') as StaticBlock;
    expect(staticBlock).toBeInstanceOf(StaticBlock);
    const staticProp = staticBlock._prop;

    expect(flow.save()).toEqual(data);

    flow.destroy();
    expect(staticProp.getValue()).toBe(staticBlock);

    // destroy persisted StaticBlock only when function is destroyed
    funcLib.delete(':cacheModeWorker1');
    expect(staticProp.getValue()).not.toBeDefined();
    libFlow.destroy();
  });
});
