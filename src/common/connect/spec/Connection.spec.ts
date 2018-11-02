import {assert} from "chai";
import {Root} from "../../block/Block";
import {makeLocalConnection} from "../LocalConnection";
import "../../functions/basic/Math";
import {AsyncClientPromise} from "./AsyncClientPromise";
import {VoidListeners, TestFunctionRunner} from "../../block/spec/TestFunction";
import {FunctionDesc} from "../../block/Descriptor";
import {shouldHappen} from "../../util/test-util";
import {JsFunction} from "../../functions/script/Js";
import {Classes} from "../../block/Class";
import {DataMap} from "../../util/Types";


describe("Connection", function () {

  it('subscribe', async function () {
    let job = Root.instance.addJob('Connection1');
    let [server, client] = makeLocalConnection(Root.instance, false);

    client.createBlock('Connection1.block1');
    await client.setValue('Connection1.block1.#is', 'add', true);
    assert.equal(job.queryValue("block1.#is"), 'add', 'basic set');

    let callbacks = new AsyncClientPromise();
    client.subscribe('Connection1.block1.output', callbacks);
    let result = await callbacks.promise;
    assert.equal(result.value, null, 'subscribe null');

    client.setValue('Connection1.block1.0', 2);
    client.updateValue('Connection1.block1.1', 3);
    result = await callbacks.promise;
    assert.equal(result.value, 5, 'subscribe basic logic result');

    // clean up
    callbacks.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection1');
  });

  it('multiple subscribe binding', async function () {
    let job = Root.instance.addJob('Connection2');
    let [server, client] = makeLocalConnection(Root.instance, false);

    client.setBinding('Connection2.p', 'p0');

    let callbacks1 = new AsyncClientPromise();
    client.subscribe('Connection2.p', callbacks1);
    let result1 = await callbacks1.promise;
    assert.equal(result1.value, null, 'initial value');
    assert.equal(result1.bindingPath, 'p0', 'initial binding');

    let callbacks2 = new AsyncClientPromise();
    client.subscribe('Connection2.p', callbacks2);
    let result2 = await callbacks2.firstPromise;
    assert.equal(result1.bindingPath, 'p0', 'second subscribe');

    client.setValue('Connection2.p1', 'hello');
    client.setBinding('Connection2.p', 'p1');
    [result1, result2] = await Promise.all([callbacks1.promise, callbacks2.promise]);

    let callbacks3 = new AsyncClientPromise();
    client.subscribe('Connection2.p', callbacks3); // subscribe when local cache exists
    let result3 = await callbacks3.firstPromise;

    for (let obj of [result1, result2, result3, result1.update, result2.update]) {
      assert.equal(obj.value, 'hello', 'change value');
      assert.equal(obj.bindingPath, 'p1', 'change binding');
    }
    let cachedPromise1 = callbacks1.promise;

    client.unsubscribe('Connection2.p', callbacks3);
    client.unsubscribe('Connection2.p', callbacks2);
    client.unsubscribe('Connection2.p', callbacks1);

    client.setValue('Connection2.p2', 'world');
    await client.setBinding('Connection2.p', 'p2');
    assert.equal(callbacks1.promise, cachedPromise1, "promise shouldn't be updated after unsubscribe");
    assert.isEmpty(job.getProperty('p')._listeners, 'property not listened after unsubscribe');

    // clean up
    callbacks1.cancel();
    callbacks2.cancel();
    callbacks3.cancel();
    client.destroy();
    Root.instance.deleteValue('Connection2');
  });

  it('multiple watch', async function () {
    let job = Root.instance.addJob('Connection3');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let child0 = job.createBlock('c0');

    let callbacks1 = new AsyncClientPromise();
    client.watch('Connection3', callbacks1);
    let result1 = await callbacks1.promise;
    assert.deepEqual(result1.changes, {'c0': child0._blockId}, 'initial value');
    assert.deepEqual(result1.cache, {'c0': child0._blockId}, 'initial cache');

    let callbacks2 = new AsyncClientPromise();
    client.watch('Connection3', callbacks2);
    let result2 = await callbacks2.firstPromise;
    assert.deepEqual(result2.changes, {'c0': child0._blockId}, 'initial value');
    assert.deepEqual(result2.cache, {'c0': child0._blockId}, 'initial cache');

    let child1 = job.createBlock('c1');
    job.createOutputBlock('t1'); // temp block shouldn't show in watch result

    [result1, result2] = await Promise.all([callbacks1.promise, callbacks2.promise]);
    assert.deepEqual(result1.changes, {'c1': child1._blockId}, 'add block changes');
    assert.deepEqual(result1.cache, {'c0': child0._blockId, 'c1': child1._blockId}, 'add block cache');
    assert.deepEqual(result2.changes, {'c1': child1._blockId}, 'add block changes');
    assert.deepEqual(result2.cache, {'c0': child0._blockId, 'c1': child1._blockId}, 'add block cache');

    client.setValue('Connection3.c0', null);
    result1 = await callbacks1.promise;
    assert.deepEqual(result1.changes, {'c0': null}, 'remove block changes');
    assert.deepEqual(result1.cache, {'c1': child1._blockId}, 'add block cache');

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

  it('list', async function () {
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

  it('watchDesc', async function () {
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

    // try it again
    let descResult2: FunctionDesc;
    client.watchDesc('add', (desc: FunctionDesc) => {
      descResult2 = desc;
    });
    await shouldHappen(() => descResult2 != null);

    assert.isNull(descCustom, 'custom class is not registered yet');
    JsFunction.registerClass('this["out"] = 1', {name: 'Connection-watchDesc1'});
    await shouldHappen(() => descCustom != null);
    Classes.clear('Connection-watchDesc1');
    await shouldHappen(() => descCustom == null);

    client.destroy();
    Root.instance.deleteValue('Connection5');
  });

  it('merge set request', async function () {
    TestFunctionRunner.clearLog();

    let job = Root.instance.addJob('Connection6');
    let [server, client] = makeLocalConnection(Root.instance, false);


    let b = job.createBlock('b');
    b.setValue('#mode', 'onCall');
    b.setValue('#sync', true);
    b.setValue('#-log', 0);
    b.setValue('#is', 'test-runner');

    client.setValue('Connection6.b.#-log', 1);
    client.setValue('Connection6.b.#call', {});
    client.setValue('Connection6.b.#-log', 2, true);
    let promise = client.setValue('Connection6.b.#call', {}, true);
    client.setValue('Connection6.b.#-log', 3);
    client.setValue('Connection6.b.#call', {});
    client.setValue('Connection6.b.#-log', 4);
    client.setValue('Connection6.b.#call', {});

    await promise;

    assert.deepEqual(TestFunctionRunner.popLogs(), [2, 4],

      'first snapshot');
    client.destroy();
    Root.instance.deleteValue('Connection6');
  });

  it('subscribe listener', async function () {
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
    await client.setBinding('Connection7.p', 'v');
    assert.isTrue(lastUpdate.hasListener);
    await client.setBinding('Connection7.p', null);
    assert.isFalse(lastUpdate.hasListener);
    client.unsubscribe('Connection7.v', callbacks);

    client.destroy();
    Root.instance.deleteValue('Connection7');
  });


});
