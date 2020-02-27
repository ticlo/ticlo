import {assert} from 'chai';
import {Block} from '../../block/Block';
import {Job, Root} from '../../block/Job';
import {makeLocalConnection} from '../LocalConnection';
import '../../functions/basic/math/Arithmetic';
import '../../functions/Categories';
import {AsyncClientPromise} from './AsyncClientPromise';
import {VoidListeners, TestFunctionRunner} from '../../block/spec/TestFunction';
import {FunctionDesc} from '../../block/Descriptor';
import {shouldHappen} from '../../util/test-util';
import {JsFunction} from '../../functions/script/Js';
import {Functions} from '../../block/Functions';
import {DataMap, isDataTruncated} from '../../util/DataTypes';
import {WorkerFunction} from '../../worker/WorkerFunction';
import {JobEditor} from '../../worker/JobEditor';

describe('Connection', function() {
  it('get', async function() {
    let job = Root.instance.addJob('Connection0');
    let data = {a: 0};
    job.setValue('v', data);

    let [server, client] = makeLocalConnection(Root.instance, false);

    let callbacks = new AsyncClientPromise();
    client.getValue('Connection0.v', callbacks);
    let result = await callbacks.promise;
    assert.deepEqual(result.value, data);

    // clean up
    callbacks.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection0');
  });

  it('subscribe', async function() {
    let job = Root.instance.addJob('Connection1');
    let [server, client] = makeLocalConnection(Root.instance, false);

    await client.createBlock('Connection1.block1', {'#is': 'add'});
    assert.equal(job.queryValue('block1.#is'), 'add', 'basic set');

    let callbacks = new AsyncClientPromise();
    client.subscribe('Connection1.block1.#output', callbacks);
    let result = await callbacks.promise;
    assert.equal(result.cache.value, null, 'subscribe null');

    client.setValue('Connection1.block1.0', 2);
    client.updateValue('Connection1.block1.1', 3);
    result = await callbacks.promise;
    assert.equal(result.change.value, 5, 'subscribe basic logic result');

    // clean up
    callbacks.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection1');
  });

  it('bind', async function() {
    let job = Root.instance.addJob('Connection1-2');
    let [server, client] = makeLocalConnection(Root.instance, false);

    job.setValue('a', 3);
    job.setValue('b', 'b');
    job.setValue('o', [{p: 'p'}]);
    await client.setBinding('Connection1-2.v', 'a', false, true);
    assert.equal(job.getValue('v'), 3);
    await client.setBinding('Connection1-2.v', 'Connection1-2.b', true, true);
    assert.equal(job.getValue('v'), 'b');
    await client.setBinding('Connection1-2.v', 'Connection1-2.o..0.p', true, true);
    assert.equal(job.getValue('v'), 'p');

    await client.setBinding('Connection1-2.v', null, false, true);
    assert.equal(job.getValue('v'), undefined);

    await client.setBinding('Connection1-2.v', 'a', false, true);
    // clear binding but keep value (when it's primitive)
    await client.setBinding('Connection1-2.v', null, true, true);
    assert.equal(job.getValue('v'), 3);

    // binding from global block
    let a = Root.instance._globalRoot.createBlock('^g');
    a.setValue('0', 'global');

    await client.setBinding('Connection1-2.v', '#global.^g.0', true, true);
    assert.equal(job.getValue('v'), 'global');
    assert.equal(job.getProperty('v')._bindingPath, '^g.0');

    // clear #global
    Root.instance._globalRoot._liveUpdate({});
    client.destroy();
    Root.instance.deleteValue('Connection1-2');
  });

  it('multiple subscribe binding', async function() {
    let job = Root.instance.addJob('Connection2');
    let [server, client] = makeLocalConnection(Root.instance, false);

    client.setBinding('Connection2.p', 'p0');

    let callbacks1 = new AsyncClientPromise();
    client.subscribe('Connection2.p', callbacks1);
    let result1 = await callbacks1.promise;
    assert.equal(result1.change.value, null, 'initial value');
    assert.equal(result1.change.bindingPath, 'p0', 'initial binding');

    let callbacks2 = new AsyncClientPromise();
    client.subscribe('Connection2.p', callbacks2);
    let result2 = await callbacks2.firstPromise;
    assert.equal(result1.change.bindingPath, 'p0', 'second subscribe');

    client.setValue('Connection2.p1', 'hello');
    client.setBinding('Connection2.p', 'p1');
    [result1, result2] = await Promise.all([callbacks1.promise, callbacks2.promise]);

    let callbacks3 = new AsyncClientPromise();
    client.subscribe('Connection2.p', callbacks3); // subscribe when local cache exists
    let result3 = await callbacks3.firstPromise;

    for (let obj of [result1.cache, result2.cache, result3.cache, result1.change, result2.change]) {
      assert.equal(obj.value, 'hello', 'change value');
      assert.equal(obj.bindingPath, 'p1', 'change binding');
    }
    let cachedPromise1 = callbacks1.promise;

    client.unsubscribe('Connection2.p', callbacks3);
    client.unsubscribe('Connection2.p', callbacks2);
    client.unsubscribe('Connection2.p', callbacks1);

    client.setValue('Connection2.p2', 'world');
    await client.setBinding('Connection2.p', 'p2', false, true);
    assert.equal(callbacks1.promise, cachedPromise1, "promise shouldn't be updated after unsubscribe");
    assert.isEmpty(job.getProperty('p')._listeners, 'property not listened after unsubscribe');

    // clean up
    callbacks1.cancel();
    callbacks2.cancel();
    callbacks3.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection2');
  });

  it('watch', async function() {
    let job = Root.instance.addJob('Connection3-0');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let child0 = job.createBlock('c0');

    let callbacks1 = new AsyncClientPromise();
    client.watch('Connection3-0', callbacks1);
    let result1 = await callbacks1.promise;
    assert.deepEqual(result1.changes, {c0: child0._blockId}, 'initial value');
    assert.deepEqual(result1.cache, {c0: child0._blockId}, 'initial cache');

    job.deleteValue('c0');
    let result2 = await callbacks1.promise;
    assert.deepEqual(result2.changes, {c0: null}, 'delete value');

    let child1 = job.createBlock('c1');
    let result3 = await callbacks1.promise;
    assert.deepEqual(result3.changes, {c1: child1._blockId});

    job.deleteValue('c1');
    let result4 = await callbacks1.promise;
    assert.deepEqual(result4.changes, {c1: null});

    // clean up
    callbacks1.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection3-0');
  });

  it('multiple watch', async function() {
    let job = Root.instance.addJob('Connection3');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let child0 = job.createBlock('c0');

    let callbacks1 = new AsyncClientPromise();
    client.watch('Connection3', callbacks1);
    let result1 = await callbacks1.promise;
    assert.deepEqual(result1.changes, {c0: child0._blockId}, 'initial value');
    assert.deepEqual(result1.cache, {c0: child0._blockId}, 'initial cache');

    let callbacks2 = new AsyncClientPromise();
    client.watch('Connection3', callbacks2);
    let result2 = await callbacks2.firstPromise;
    assert.deepEqual(result2.changes, {c0: child0._blockId}, 'initial value');
    assert.deepEqual(result2.cache, {c0: child0._blockId}, 'initial cache');

    let child1 = job.createBlock('c1');
    job.createOutputBlock('t1'); // temp block shouldn't show in watch result
    [result1, result2] = await Promise.all([callbacks1.promise, callbacks2.promise]);
    assert.deepEqual(result1.changes, {c1: child1._blockId}, 'add block changes');
    assert.deepEqual(result1.cache, {c0: child0._blockId, c1: child1._blockId}, 'add block cache');
    assert.deepEqual(result2.changes, {c1: child1._blockId}, 'add block changes');
    assert.deepEqual(result2.cache, {c0: child0._blockId, c1: child1._blockId}, 'add block cache');

    client.setValue('Connection3.c0', null);
    result1 = await callbacks1.promise;
    assert.deepEqual(result1.changes, {c0: null}, 'remove block changes');
    assert.deepEqual(result1.cache, {c1: child1._blockId}, 'add block cache');

    let cachedPromise1 = callbacks1.promise;

    client.unwatch('Connection3', callbacks2);
    client.unwatch('Connection3', callbacks1);

    await client.createBlock('Connection3.c2');
    assert.equal(callbacks1.promise, cachedPromise1, "promise shouldn't be updated after unwatch");
    assert.isNull(job._watchers, 'job not watched after unwatch');

    // clean up
    callbacks1.cancel();
    callbacks2.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection3');
  });

  it('list', async function() {
    let job = Root.instance.addJob('Connection4');
    let [server, client] = makeLocalConnection(Root.instance, false);

    for (let i = 0; i < 100; ++i) {
      job.createBlock('a' + i);
      job.createBlock('b' + i);
    }

    let result1 = await client.listChildren('Connection4', null, 32);
    assert.equal(Object.keys(result1.children).length, 32, 'list should show 32 children');
    assert.equal(result1.count, 200, 'list return number of all children');

    let id2: string = client.listChildren('Connection4', 'any', 32, VoidListeners) as string;
    client.cancel(id2);

    let result3 = await client.listChildren('Connection4', 'a\\d+', 9999);
    assert.equal(Object.keys(result3.children).length, 16, 'list more than 1024, fallback to 16');
    assert.equal(result3.count, 100, 'list return number of filtered children');

    client.destroy();
    Root.instance.deleteValue('Connection4');
  });

  it('watchDesc', async function() {
    let job = Root.instance.addJob('Connection5');
    let [server, client] = makeLocalConnection(Root.instance, true);

    let descCustom: FunctionDesc;
    client.watchDesc('Connection-watchDesc1', (desc: FunctionDesc) => {
      descCustom = desc;
    });

    let descResult1: FunctionDesc;
    client.watchDesc('add', (desc: FunctionDesc) => {
      descResult1 = desc;
    });
    await shouldHappen(() => descResult1 != null);

    assert.isNotNull(client.watchDesc('add'));

    // try it again
    let descResult2: FunctionDesc;
    client.watchDesc('add', (desc: FunctionDesc) => {
      descResult2 = desc;
    });
    await shouldHappen(() => descResult2 != null);

    assert.isNull(descCustom, 'custom class is not registered yet');
    JsFunction.registerType('this["out"] = 1', {
      name: 'Connection-watchDesc1'
    });
    await shouldHappen(() => descCustom != null);
    Functions.clear('Connection-watchDesc1');
    await shouldHappen(() => descCustom == null);

    assert.equal(client.getCategory('math').color, '4af');

    client.destroy();
    Root.instance.deleteValue('Connection5');
  });

  it('merge set request', async function() {
    TestFunctionRunner.clearLog();

    let job = Root.instance.addJob('Connection6');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let b = job.createBlock('b');
    b.setValue('#mode', 'onCall');
    b.setValue('#sync', true);
    b.setValue('#-log', 0);
    b.setValue('#is', 'test-runner');

    let callbacks = new AsyncClientPromise();

    client.setValue('Connection6.b.#-log', 1);
    client.setValue('Connection6.b.#call', {});
    client.setValue('Connection6.b.#-log', 2, true);
    client.setValue('Connection6.b.#call', {}, callbacks);
    client.setValue('Connection6.b.#-log', 3);
    client.setValue('Connection6.b.#call', {});
    client.setValue('Connection6.b.#-log', 4);
    client.setValue('Connection6.b.#call', {});

    await callbacks.promise;

    assert.deepEqual(
      TestFunctionRunner.popLogs(),
      [2, 4],

      'first snapshot'
    );
    client.destroy();
    Root.instance.deleteValue('Connection6');
  });

  it('merge update request', async function() {
    TestFunctionRunner.clearLog();

    let job = Root.instance.addJob('Connection6-2');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let b = job.createBlock('b');
    b.updateValue('#mode', 'onCall');
    b.updateValue('#sync', true);
    b.updateValue('#-log', 0);
    b.updateValue('#is', 'test-runner');

    let callbacks = new AsyncClientPromise();

    client.updateValue('Connection6-2.b.#-log', 1);
    client.updateValue('Connection6-2.b.#call', {});
    client.updateValue('Connection6-2.b.#-log', 2, true);
    client.updateValue('Connection6-2.b.#call', {}, callbacks);
    client.updateValue('Connection6-2.b.#-log', 3);
    client.updateValue('Connection6-2.b.#call', {});
    client.updateValue('Connection6-2.b.#-log', 4);
    client.updateValue('Connection6-2.b.#call', {});

    await callbacks.promise;

    assert.deepEqual(
      TestFunctionRunner.popLogs(),
      [2, 4],

      'first snapshot'
    );
    client.destroy();
    Root.instance.deleteValue('Connection6-2');
  });

  it('merge bind request', async function() {
    TestFunctionRunner.clearLog();

    let job = Root.instance.addJob('Connection6-3');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let b = job.createBlock('b');
    b.setValue('@1', 1);
    b.setValue('@2', 2);
    b.setValue('@3', 3);
    b.setValue('@4', 4);

    b.setValue('#mode', 'onCall');
    b.setValue('#sync', true);
    b.setValue('#-log', 0);
    b.setValue('#is', 'test-runner');

    let callbacks = new AsyncClientPromise();

    client.setBinding('Connection6-3.b.#-log', '@1');
    client.setBinding('Connection6-3.b.#call', '@1');
    client.setBinding('Connection6-3.b.#-log', '@2', false, true);
    client.setBinding('Connection6-3.b.#call', '@2', false, callbacks);
    client.setBinding('Connection6-3.b.#-log', '@3');
    client.setBinding('Connection6-3.b.#call', '@3');
    client.setBinding('Connection6-3.b.#-log', '@4');
    client.setBinding('Connection6-3.b.#call', '@4');

    await callbacks.promise;

    assert.deepEqual(
      TestFunctionRunner.popLogs(),
      [2, 4],

      'first snapshot'
    );
    client.destroy();
    Root.instance.deleteValue('Connection6-3');
  });

  it('subscribe listener', async function() {
    let job = Root.instance.addJob('Connection7');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let lastUpdate: DataMap;
    let callbacks = {
      onUpdate(response: DataMap) {
        lastUpdate = response;
      }
    };

    client.setValue('Connection7.v', 1);
    client.subscribe('Connection7.v', callbacks);
    await client.setBinding('Connection7.p', 'v', false, true);
    assert.isTrue(lastUpdate.change.hasListener);
    await client.setBinding('Connection7.p', null, false, true);
    assert.isFalse(lastUpdate.change.hasListener);
    client.unsubscribe('Connection7.v', callbacks);

    client.destroy();
    Root.instance.deleteValue('Connection7');
  });

  it('callImmediate', async function() {
    let job = Root.instance.addJob('Connection8');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let called = 0;
    let updated = 0;
    let callback = () => called++;

    client.callImmediate(callback);
    assert.equal(called, 1, 'call immediate');

    let callbacks1 = {
      onUpdate(response: DataMap) {
        client.callImmediate(callback);
        updated++;
        assert.equal(called, 1, 'callback wont be called during update');
      }
    };
    let callbacks2 = {
      onUpdate(response: DataMap) {
        client.callImmediate(callback);
        updated++;
        assert.equal(called, 1, 'callback wont be called during update');
      }
    };
    client.setValue('Connection8.v', 1);
    client.subscribe('Connection8.v', callbacks1);
    client.subscribe('Connection8.v', callbacks2);

    assert.equal(called, 1, 'not called');

    await shouldHappen(() => updated === 2 && called === 2);

    client.destroy();
    Root.instance.deleteValue('Connection8');
  });

  it('set a saved block', async function() {
    let job = Root.instance.addJob('Connection9');
    let [server, client] = makeLocalConnection(Root.instance, false);

    await client.setValue('Connection9.v', {'#is': 'hello'});

    let callbacks = new AsyncClientPromise();
    client.subscribe('Connection9.v', callbacks);
    let result = await callbacks.promise;
    assert.deepEqual(result.cache.value, {'#is': 'hello'});

    callbacks.cancel();

    client.destroy();
    Root.instance.deleteValue('Connection9');
  });

  it('auto bind', async function() {
    let job1 = Root.instance.addJob('Connection10');

    job1.load({
      c: {
        '#is': '',
        'd': {'#is': ''},
        'e': {'#is': ''}
      },
      f: {
        '#is': ''
      }
    });

    let [server, client] = makeLocalConnection(Root.instance, false);

    client.setBinding('Connection10.c.e.v1', 'Connection10.c.d.v1', true);
    client.setBinding('Connection10.c.e.v2', 'Connection10.c.e.v1', true);
    client.setBinding('Connection10.c.e.v3', 'Connection10.f.v3', true);
    client.setBinding('Connection10.c.v4', 'Connection10.f.v4', true);

    await shouldHappen(() => job1.queryProperty('c.e.v2', true)._bindingPath === 'v1');
    await shouldHappen(() => job1.queryProperty('c.e.v1', true)._bindingPath === '##.d.v1');
    await shouldHappen(() => job1.queryProperty('c.e.v3', true)._bindingPath === '###.f.v3');
    await shouldHappen(() => job1.queryProperty('c.v4', true)._bindingPath === '##.f.v4');

    client.destroy();
    Root.instance.deleteValue('Connection10');
  });

  it('full value', async function() {
    let job1 = Root.instance.addJob('Connection11');

    job1.load({
      '@v': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    });

    let [server, client] = makeLocalConnection(Root.instance, false);

    let callbacks1 = new AsyncClientPromise();
    client.subscribe('Connection11.@v', callbacks1);
    let result1 = await callbacks1.promise;

    assert.isTrue(isDataTruncated(result1.cache.value));

    let callbacks2 = new AsyncClientPromise();
    client.subscribe('Connection11.@v', callbacks2, true);
    let result2 = await callbacks2.promise;

    assert.isFalse(isDataTruncated(result2.cache.value));

    // callback1 should not receive a full update
    assert.isTrue(isDataTruncated(callbacks1.lastResponse.cache.value));

    callbacks1.cancel();
    callbacks2.cancel();

    client.destroy();
    Root.instance.deleteValue('Connection11');
  });

  it('helper property', async function() {
    let job1 = Root.instance.addJob('Connection12');

    let [server, client] = makeLocalConnection(Root.instance, false);

    await client.createBlock('Connection12.~a');

    assert.instanceOf(job1.getValue('~a'), Block);
    assert.equal(job1.getProperty('a')._bindingPath, '~a.#output');

    // transfer property value
    await client.setValue('Connection12.b', 2);
    await client.createBlock('Connection12.~b', {'#is': 'add'});
    assert.equal(job1.queryValue('~b.0'), 2);

    // transfer property binding
    await client.setBinding('Connection12.c', '##.v');
    await client.createBlock('Connection12.~c', {'#is': 'add'});
    assert.equal(job1.queryProperty('~c.0')._bindingPath, '##.##.v');

    client.destroy();
    Root.instance.deleteValue('Connection12');
  });

  it('autoName', async function() {
    let job1 = Root.instance.addJob('Connection13');

    let [server, client] = makeLocalConnection(Root.instance, false);

    let response1 = await client.createBlock('Connection13.a', null, true);
    let response2 = await client.createBlock('Connection13.a', null, true);
    let response3 = await client.createBlock('Connection13.a', null, true);

    // result names
    assert.equal(response1.name, 'a');
    assert.equal(response2.name, 'a0');
    assert.equal(response3.name, 'a1');

    // a a0 a1 should all be created
    assert.instanceOf(job1.getValue('a1'), Block);

    client.destroy();
    Root.instance.deleteValue('Connection13');
  });

  it('show hide move props', async function() {
    let job1 = Root.instance.addJob('Connection14');
    let block1 = job1.createBlock('a');

    let [server, client] = makeLocalConnection(Root.instance, false);

    let response1 = await client.showProps('Connection14.a', ['@a', '@b']);
    assert.deepEqual(block1.getValue('@b-p'), ['@a', '@b']);

    let response2 = await client.moveShownProp('Connection14.a', '@a', '@b');
    assert.deepEqual(block1.getValue('@b-p'), ['@b', '@a']);

    let response3 = await client.hideProps('Connection14.a', ['@a', '@b']);
    assert.isUndefined(block1.getValue('@b-p'));

    client.destroy();
    Root.instance.deleteValue('Connection14');
  });

  it('add remove custom props', async function() {
    let job1 = Root.instance.addJob('Connection15');
    let block1 = job1.createBlock('a');

    let [server, client] = makeLocalConnection(Root.instance, false);

    let response1 = await client.addCustomProp('Connection15.a', {
      name: 'a',
      type: 'string'
    });
    assert.deepEqual(block1.getValue('#custom'), [{name: 'a', type: 'string'}]);

    let response2 = await client.removeCustomProp('Connection15.a', 'a');
    assert.isUndefined(block1.getValue('#custom'));

    client.destroy();
    Root.instance.deleteValue('Connection15');
  });

  it('insert remove group props', async function() {
    let job1 = Root.instance.addJob('Connection16');
    let block1 = job1.createBlock('a');
    block1._load({
      '#is': 'add',
      '0': 0,
      '1': 1
    });

    let [server, client] = makeLocalConnection(Root.instance, false);

    let response1 = await client.insertGroupProp('Connection16.a', '', 0);
    assert.equal(block1.getValue('#len'), 3);
    assert.equal(block1.getValue('1'), 0);

    let response2 = await client.removeGroupProp('Connection16.a', '', 0);
    assert.equal(block1.getValue('#len'), 2);
    assert.equal(block1.getValue('0'), 0);

    let response3 = await client.moveGroupProp('Connection16.a', '', 0, 1);
    assert.equal(block1.getValue('1'), 0);

    client.destroy();
    Root.instance.deleteValue('Connection16');
  });

  it('set length', async function() {
    let job1 = Root.instance.addJob('Connection16-2');
    let block1 = job1.createBlock('a');
    block1.setValue('#is', 'add');

    let [server, client] = makeLocalConnection(Root.instance, false);

    let response1 = await client.setLen('Connection16-2.a', '', 3);
    assert.deepEqual(block1.getValue('@b-p'), ['2']);

    client.destroy();
    Root.instance.deleteValue('Connection16-2');
  });

  it('move custom props', async function() {
    let job1 = Root.instance.addJob('Connection17');
    let block1 = job1.createBlock('a');
    block1.setValue('#custom', [
      {name: 'a', type: 'string'},
      {name: 'b', type: 'string'}
    ]);

    let [server, client] = makeLocalConnection(Root.instance, false);

    let response1 = await client.moveCustomProp('Connection17.a', 'a', 'b');
    assert.deepEqual(block1.getValue('#custom'), [
      {name: 'b', type: 'string'},
      {name: 'a', type: 'string'}
    ]);

    client.destroy();
    Root.instance.deleteValue('Connection17');
  });

  it('findGlobalBlocks', async function() {
    let [server, client] = makeLocalConnection(Root.instance, true);

    let a = Root.instance._globalRoot.createBlock('^a');
    a.setValue('#is', 'add');
    let b = Root.instance._globalRoot.createBlock('^b');
    b.setValue('#is', 'subtract');

    await shouldHappen(() => client.findGlobalBlocks(['math']).length === 2);

    assert.deepEqual(client.findGlobalBlocks(['math-2']), ['^b']);

    a.setValue('#is', 'subtract');
    await shouldHappen(() => client.findGlobalBlocks(['math-2']).length === 2);
    assert.isEmpty(client.findGlobalBlocks(['math-n']));

    // clear #global
    Root.instance._globalRoot._liveUpdate({});
    await shouldHappen(() => client.findGlobalBlocks(['math']).length === 0);

    client.destroy();
  });

  it('JobEditor', async function() {
    let job1 = Root.instance.addJob('Connection18');
    let block1 = job1.createBlock('a');
    let data = {
      '#is': '',
      'add': {'#is': 'add'}
    };

    let [server, client] = makeLocalConnection(Root.instance, true);

    // edit from field
    client.setValue('Connection18.a.use', data);
    await client.editWorker('Connection18.a.#edit-use', 'use');
    assert.deepEqual(block1.getValue('#edit-use').save(), data);

    WorkerFunction.registerType(data, {name: 'func1'}, '');

    // edit from worker function
    await client.editWorker('Connection18.a.#edit-func1', null, ':func1');
    assert.deepEqual(block1.getValue('#edit-func1').save(), data);

    Functions.clear(':func1');
    client.destroy();
    Root.instance.deleteValue('Connection18');
  });

  it('applyJobChange', async function() {
    let job1 = Root.instance.addJob('Connection19');
    let [server, client] = makeLocalConnection(Root.instance, true);

    let editor = JobEditor.create(job1, '#edit-v', {}, null, false, (data: DataMap) => {
      job1.setValue('v', data);
      return true;
    });
    await client.applyJobChange('Connection19.#edit-v');
    assert.deepEqual(job1.getValue('v'), {'#is': ''});

    client.destroy();
    Root.instance.deleteValue('Connection19');
  });

  it('createJob and DeleteJob', async function() {
    let [server, client] = makeLocalConnection(Root.instance, true);

    await client.addJob('Connection20', {value: 123});
    assert.instanceOf(Root.instance.getValue('Connection20'), Job);

    await client.addJob('Connection20.subjob', {value: 123});
    assert.instanceOf(Root.instance.queryValue('Connection20.subjob'), Job);

    await client.setValue('Connection20', undefined, true);
    assert.isUndefined(Root.instance.getValue('Connection20'));

    client.destroy();
  });

  it('add remove move optional props', async function() {
    let job1 = Root.instance.addJob('Connection21');
    let block1 = job1.createBlock('a');

    let [server, client] = makeLocalConnection(Root.instance, false);

    await client.addOptionalProp('Connection21.a', 'a');
    assert.deepEqual(block1.getValue('#optional'), ['a']);

    await client.addOptionalProp('Connection21.a', 'b');
    assert.deepEqual(block1.getValue('#optional'), ['a', 'b']);

    await client.moveOptionalProp('Connection21.a', 'a', 'b');
    assert.deepEqual(block1.getValue('#optional'), ['b', 'a']);

    await client.removeOptionalProp('Connection21.a', 'a');
    assert.deepEqual(block1.getValue('#optional'), ['b']);

    client.destroy();
    Root.instance.deleteValue('Connection21');
  });
});
