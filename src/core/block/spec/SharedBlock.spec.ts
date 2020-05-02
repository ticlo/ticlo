import {assert} from 'chai';
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
    assert.instanceOf(sharedBlock, SharedBlock);
    assert.equal(sharedBlock._cacheKey, data['#shared']);

    let flow2 = new FlowWithShared();
    flow2.load(data);
    assert.equal(flow2.getValue('#shared'), sharedBlock);

    flow1.destroy();
    assert.isFalse(sharedBlock._destroyed);
    flow2.destroy();
    assert.isTrue(sharedBlock._destroyed);
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
    assert.deepEqual(saved, {'#is': '', '#shared': {'#is': '', 'v': 1, '#custom': [{name: 'v', type: 'string'}]}});

    sharedBlock.setValue('v', 2);

    flow.liveUpdate(saved);
    assert.equal(sharedBlock.getValue('v'), 1);

    flow.liveUpdate({'#is': ''});
    assert.isUndefined(sharedBlock.getValue('v'));
    assert.deepEqual(flow.save(), {'#is': ''});

    flow.destroy();
    assert.isUndefined(sharedProp.getValue());
  });

  it('cacheMode', function () {
    let data = {'#is': '', '#shared': {'#is': '', '#cacheMode': 'persist'}};
    WorkerFunction.registerType(data, {name: 'cacheModeWorker1', properties: []}, 'SharedBlock');

    let flow = new WorkerFlow();
    flow.load(data, 'SharedBlock:cacheModeWorker1');
    assert.deepEqual(flow.save(), data);

    let sharedBlock: SharedBlock = flow.getValue('#shared');
    assert.instanceOf(sharedBlock, SharedBlock);
    let sharedProp = sharedBlock._prop;

    assert.deepEqual(flow.save(), data);

    flow.destroy();
    assert.equal(sharedProp.getValue(), sharedBlock);

    // destroy persisted SharedBlock only when function is destroyed
    Functions.clear('SharedBlock:cacheModeWorker1');
    assert.isUndefined(sharedProp.getValue());
  });
});
