import {assert} from 'chai';
import {FlowWithShared, SharedBlock} from '../SharedBlock';
import {WorkerFunction} from '../../worker/WorkerFunction';
import {Functions} from '../Functions';
import {WorkerFlow} from '../../worker/WorkerFlow';

describe('SharedBlock', function () {
  it('basic', function () {
    let data = {'#is': '', '#shared': {'#is': ''}};

    let job1 = new FlowWithShared();
    job1.load(data);
    let sharedBlock: SharedBlock = job1.getValue('#shared');
    assert.instanceOf(sharedBlock, SharedBlock);
    assert.equal(sharedBlock._cacheKey, data['#shared']);

    let job2 = new FlowWithShared();
    job2.load(data);
    assert.equal(job2.getValue('#shared'), sharedBlock);

    job1.destroy();
    assert.isFalse(sharedBlock._destroyed);
    job2.destroy();
    assert.isTrue(sharedBlock._destroyed);
  });

  it('save load', function () {
    let data = {'#is': '', '#shared': {'#is': ''}};

    let job = new FlowWithShared();
    job.load(data);
    let sharedBlock: SharedBlock = job.getValue('#shared');
    let sharedProp = sharedBlock._prop;
    sharedBlock.setValue('v', 1);
    sharedBlock.setValue('#custom', [{name: 'v', type: 'string'}]);

    let saved = job.save();
    assert.deepEqual(saved, {'#is': '', '#shared': {'#is': '', 'v': 1, '#custom': [{name: 'v', type: 'string'}]}});

    sharedBlock.setValue('v', 2);

    job.liveUpdate(saved);
    assert.equal(sharedBlock.getValue('v'), 1);

    job.liveUpdate({'#is': ''});
    assert.isUndefined(sharedBlock.getValue('v'));
    assert.deepEqual(job.save(), {'#is': ''});

    job.destroy();
    assert.isUndefined(sharedProp.getValue());
  });

  it('cacheMode', function () {
    let data = {'#is': '', '#shared': {'#is': '', '#cacheMode': 'persist'}};
    WorkerFunction.registerType(data, {name: 'cacheModeWorker1', properties: []}, 'SharedBlock');

    let job = new WorkerFlow();
    job.load(data, 'SharedBlock:cacheModeWorker1');
    assert.deepEqual(job.save(), data);

    let sharedBlock: SharedBlock = job.getValue('#shared');
    assert.instanceOf(sharedBlock, SharedBlock);
    let sharedProp = sharedBlock._prop;

    assert.deepEqual(job.save(), data);

    job.destroy();
    assert.equal(sharedProp.getValue(), sharedBlock);

    // destroy persisted SharedBlock only when function is destroyed
    Functions.clear('SharedBlock:cacheModeWorker1');
    assert.isUndefined(sharedProp.getValue());
  });
});
