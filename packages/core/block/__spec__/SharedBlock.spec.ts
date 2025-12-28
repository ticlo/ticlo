import {expect} from 'vitest';
import {FlowWithShared, SharedBlock} from '../SharedBlock.js';
import {WorkerFunctionGen} from '../../worker/WorkerFunctionGen.js';
import {Functions} from '../Functions.js';
import {WorkerFlow} from '../../worker/WorkerFlow.js';

describe('SharedBlock', function () {
  it('basic', function () {
    const data = {'#is': '', '#shared': {'#is': ''}};

    const flow1 = new FlowWithShared();
    flow1.load(data);
    const sharedBlock: SharedBlock = flow1.getValue('#shared') as SharedBlock;
    expect(sharedBlock).toBeInstanceOf(SharedBlock);
    expect(sharedBlock._cacheKey).toBe(data['#shared']);

    const flow2 = new FlowWithShared();
    flow2.load(data);
    expect(flow2.getValue('#shared')).toBe(sharedBlock);

    flow1.destroy();
    expect(sharedBlock._destroyed).toBe(false);
    flow2.destroy();
    expect(sharedBlock._destroyed).toBe(true);
  });

  it('save load', function () {
    const data = {'#is': '', '#shared': {'#is': ''}};

    const flow = new FlowWithShared();
    flow.load(data);
    const sharedBlock: SharedBlock = flow.getValue('#shared') as SharedBlock;
    const sharedProp = sharedBlock._prop;
    sharedBlock.setValue('v', 1);
    sharedBlock.setValue('#custom', [{name: 'v', type: 'string'}]);

    const saved = flow.save();
    expect(saved).toEqual({'#is': '', '#shared': {'#is': '', 'v': 1, '#custom': [{name: 'v', type: 'string'}]}});

    sharedBlock.setValue('v', 2);

    flow.liveUpdate(saved);
    expect(sharedBlock.getValue('v')).toBe(1);

    flow.liveUpdate({'#is': ''});
    expect(sharedBlock.getValue('v')).not.toBeDefined();
    expect(flow.save()).toEqual({'#is': ''});

    flow.destroy();
    expect(sharedProp.getValue()).not.toBeDefined();
  });

  it('cacheMode', function () {
    const data = {'#is': '', '#shared': {'#is': '', '#cacheMode': 'persist'}};
    WorkerFunctionGen.registerType(data, {name: 'cacheModeWorker1', properties: []}, 'SharedBlock');

    const flow = new WorkerFlow();
    flow.load(data, 'SharedBlock:cacheModeWorker1');
    expect(flow.save()).toEqual(data);

    const sharedBlock: SharedBlock = flow.getValue('#shared') as SharedBlock;
    expect(sharedBlock).toBeInstanceOf(SharedBlock);
    const sharedProp = sharedBlock._prop;

    expect(flow.save()).toEqual(data);

    flow.destroy();
    expect(sharedProp.getValue()).toBe(sharedBlock);

    // destroy persisted SharedBlock only when function is destroyed
    Functions.clear('SharedBlock:cacheModeWorker1');
    expect(sharedProp.getValue()).not.toBeDefined();
  });
});
