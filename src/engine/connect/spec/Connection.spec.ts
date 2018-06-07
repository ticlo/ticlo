import { assert } from "chai";
import { Root } from "../../block/Job";
import { makeLocalConnection } from "../LocalConnection";
import { AddFunction } from "../../functions/basic/Math";
import { DataMap } from "../../util/Types";
import { AsyncClientPromise } from "./AsyncClientPromise";

const initAdd = AddFunction;

describe("Connection", () => {

  it('subscribe', async () => {
    let job = Root.instance.addJob('job1');
    let [server, client] = makeLocalConnection(Root.instance);

    client.createBlock('job1.block1');
    await client.setValue('job1.block1.#is', 'add');
    assert.equal(job.queryProperty("block1.#is").getValue(), 'add', 'basic set');

    let callbacks = new AsyncClientPromise();
    client.subscribe('job1.block1.output', callbacks);
    let result = await callbacks.promise;
    assert.equal(result.value, null, 'subscribe null');

    client.setValue('job1.block1.0', 2);
    client.updateValue('job1.block1.1', 3);
    result = await callbacks.promise;
    assert.equal(result.value, 5, 'subscribe basic logic result');

    // clean up
    callbacks.cancel();
    client.destroy();
    Root.instance.setValue('job1', null);
  });

  it('multiple subscribe binding', async () => {
    let job = Root.instance.addJob('job2');
    let [server, client] = makeLocalConnection(Root.instance);

    client.setBinding('job2.p', 'p0');

    let callbacks1 = new AsyncClientPromise();
    client.subscribe('job2.p', callbacks1);
    let result1 = await callbacks1.promise;
    assert.equal(result1.value, null, 'initial value');
    assert.equal(result1.bindingPath, 'p0', 'initial binding');

    let callbacks2 = new AsyncClientPromise();
    client.subscribe('job2.p', callbacks2);
    let result2 = await callbacks2.firstPromise;
    assert.equal(result1.bindingPath, 'p0', 'second subscribe');

    client.setValue('job2.p1', 'hello');
    client.setBinding('job2.p', 'p1');
    [result1, result2] = await Promise.all([callbacks1.promise, callbacks2.promise])
    assert.equal(result1.value, 'hello', 'change value');
    assert.equal(result1.bindingPath, 'p1', 'change binding');
    assert.equal(result2.value, 'hello', 'change value');
    assert.equal(result2.bindingPath, 'p1', 'change binding for second subscribe');

    let cachedPromise1 = callbacks1.promise;

    client.unsubscribe('job2.p', callbacks2);
    client.unsubscribe('job2.p', callbacks1);

    client.setValue('job2.p2', 'world');
    await client.setBinding('job2.p', 'p2');
    assert.equal(callbacks1.promise, cachedPromise1, "promise shouldn't be updated after unsubscribe");
    assert.isEmpty(job.getProperty('p')._listeners, 'property not listened after unsubscribe');

    // clean up
    callbacks1.cancel();
    client.destroy();
    Root.instance.setValue('job2', null);
  });

  it('multiple watch', async () => {
    let job = Root.instance.addJob('job3');
    let [server, client] = makeLocalConnection(Root.instance);

    let child0 = job.createBlock('c0');

    let callbacks1 = new AsyncClientPromise();
    client.watch('job3', callbacks1);
    let result1 = await callbacks1.promise;
    assert.deepEqual(result1.changes, {'c0': child0._blockId}, 'initial value');
    assert.deepEqual(result1.cache, {'c0': child0._blockId}, 'initial cache');

    let callbacks2 = new AsyncClientPromise();
    client.watch('job3', callbacks2);
    let result2 = await callbacks2.firstPromise;
    assert.deepEqual(result2.changes, {'c0': child0._blockId}, 'initial value');
    assert.deepEqual(result2.cache, {'c0': child0._blockId}, 'initial cache');

    let child1 = job.createBlock('c1');

    [result1, result2] = await Promise.all([callbacks1.promise, callbacks2.promise]);
    assert.deepEqual(result1.changes, {'c1': child1._blockId}, 'add block changes');
    assert.deepEqual(result1.cache, {'c0': child0._blockId, 'c1': child1._blockId}, 'add block cache');
    assert.deepEqual(result2.changes, {'c1': child1._blockId}, 'add block changes');
    assert.deepEqual(result2.cache, {'c0': child0._blockId, 'c1': child1._blockId}, 'add block cache');

    client.setValue('job3.c0', null);
    result1 = await callbacks1.promise;
    assert.deepEqual(result1.changes, {'c0': null}, 'remove block changes');
    assert.deepEqual(result1.cache, {'c1': child1._blockId}, 'add block cache');

    let cachedPromise1 = callbacks1.promise;

    client.unwatch('job3', callbacks2);
    client.unwatch('job3', callbacks1);

    await client.createBlock('job3.c2');
    assert.equal(callbacks1.promise, cachedPromise1, "promise shouldn't be updated after unwatch");
    assert.isNull(job._watchers, 'job not watched after unwatch');

    // clean up
    callbacks1.cancel();
    client.destroy();
    Root.instance.setValue('job3', null);
  });
});
