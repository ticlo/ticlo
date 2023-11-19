import expect from 'expect';
import {FlowWithShared, SharedBlock} from '../SharedBlock';
import {WorkerFunction} from '../../worker/WorkerFunction';
import {Functions} from '../Functions';
import {WorkerFlow} from '../../worker/WorkerFlow';

describe('SharedBlock', function () {
  it('basic', function () {
    let data = {'#is': '', '#shared': {'#is': ''}};

    let flow1 = new FlowWithShared();
    flow1.load(data);
    let sharedBlock: SharedBlock = flow1.getValue('#shared');
    expect(sharedBlock).toBeInstanceOf(SharedBlock);
    expect(sharedBlock._cacheKey).toBe(data['#shared']);

    let flow2 = new FlowWithShared();
    flow2.load(data);
    expect(flow2.getValue('#shared')).toBe(sharedBlock);

    flow1.destroy();
    expect(sharedBlock._destroyed).toBe(false);
    flow2.destroy();
    expect(sharedBlock._destroyed).toBe(true);
  });

  it('save load', function () {
    let data = {'#is': '', '#shared': {'#is': ''}};

    let flow = new FlowWithShared();
    flow.load(data);
    let sharedBlock: SharedBlock = flow.getValue('#shared');
    let sharedProp = sharedBlock._prop;
    sharedBlock.setValue('v', 1);
    sharedBlock.setValue('#custom', [{name: 'v', type: 'string'}]);

    let saved = flow.save();
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
    let data = {'#is': '', '#shared': {'#is': '', '#cacheMode': 'persist'}};
    WorkerFunction.registerType(data, {name: 'cacheModeWorker1', properties: []}, 'SharedBlock');

    let flow = new WorkerFlow();
    flow.load(data, 'SharedBlock:cacheModeWorker1');
    expect(flow.save()).toEqual(data);

    let sharedBlock: SharedBlock = flow.getValue('#shared');
    expect(sharedBlock).toBeInstanceOf(SharedBlock);
    let sharedProp = sharedBlock._prop;

    expect(flow.save()).toEqual(data);

    flow.destroy();
    expect(sharedProp.getValue()).toBe(sharedBlock);

    // destroy persisted SharedBlock only when function is destroyed
    Functions.clear('SharedBlock:cacheModeWorker1');
    expect(sharedProp.getValue()).not.toBeDefined();
  });
});
