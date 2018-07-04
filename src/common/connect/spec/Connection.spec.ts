import { assert } from "chai";
import { Root } from "../../block/Job";
import { makeLocalConnection } from "../LocalConnection";
import { AddFunction } from "../../functions/basic/Math";
import { DataMap } from "../../util/Types";
import { AsyncClientPromise } from "./AsyncClientPromise";

const initAdd = AddFunction;

describe("Connection", () => {

  it('subscribe', async () => {
    let job = Root.instance.addJob('Connection1');
    let [server, client] = makeLocalConnection(Root.instance);

    client.createBlock('Connection1.block1');
    await client.setValue('Connection1.block1.#is', 'add');
    assert.equal(job.queryProperty("block1.#is").getValue(), 'add', 'basic set');

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
    Root.instance.setValue('Connection1', null);
  });

  it('multiple subscribe binding', async () => {
    let job = Root.instance.addJob('Connection2');
    let [server, client] = makeLocalConnection(Root.instance);

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
    [result1, result2] = await Promise.all([callbacks1.promise, callbacks2.promise])
    assert.equal(result1.value, 'hello', 'change value');
    assert.equal(result1.bindingPath, 'p1', 'change binding');
    assert.equal(result2.value, 'hello', 'change value');
    assert.equal(result2.bindingPath, 'p1', 'change binding for second subscribe');

    let cachedPromise1 = callbacks1.promise;

    client.unsubscribe('Connection2.p', callbacks2);
    client.unsubscribe('Connection2.p', callbacks1);

    client.setValue('Connection2.p2', 'world');
    await client.setBinding('Connection2.p', 'p2');
    assert.equal(callbacks1.promise, cachedPromise1, "promise shouldn't be updated after unsubscribe");
    assert.isEmpty(job.getProperty('p')._listeners, 'property not listened after unsubscribe');

    // clean up
    callbacks1.cancel();
    callbacks2.cancel();
    client.destroy();
    Root.instance.setValue('Connection2', null);
  });

  it('multiple watch', async () => {
    let job = Root.instance.addJob('Connection3');
    let [server, client] = makeLocalConnection(Root.instance);

    let child0 = job.createBlock('c0');

    let callbacks1 = new AsyncClientPromise();
    client.watch('Connection3', callbacks1);
    let result1 = await callbacks1.promise;
    assert.deepEqual(result1.changes, { 'c0': child0._blockId }, 'initial value');
    assert.deepEqual(result1.cache, { 'c0': child0._blockId }, 'initial cache');

    let callbacks2 = new AsyncClientPromise();
    client.watch('Connection3', callbacks2);
    let result2 = await callbacks2.firstPromise;
    assert.deepEqual(result2.changes, { 'c0': child0._blockId }, 'initial value');
    assert.deepEqual(result2.cache, { 'c0': child0._blockId }, 'initial cache');

    let child1 = job.createBlock('c1');
    job.createOutputBlock('t1'); // temp block shouldn't show in watch result

    [result1, result2] = await Promise.all([callbacks1.promise, callbacks2.promise]);
    assert.deepEqual(result1.changes, { 'c1': child1._blockId }, 'add block changes');
    assert.deepEqual(result1.cache, { 'c0': child0._blockId, 'c1': child1._blockId }, 'add block cache');
    assert.deepEqual(result2.changes, { 'c1': child1._blockId }, 'add block changes');
    assert.deepEqual(result2.cache, { 'c0': child0._blockId, 'c1': child1._blockId }, 'add block cache');

    client.setValue('Connection3.c0', null);
    result1 = await callbacks1.promise;
    assert.deepEqual(result1.changes, { 'c0': null }, 'remove block changes');
    assert.deepEqual(result1.cache, { 'c1': child1._blockId }, 'add block cache');

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
    Root.instance.setValue('Connection3', null);
  });

  it('list', async () => {
    let job = Root.instance.addJob('Connection4');
    let [server, client] = makeLocalConnection(Root.instance);

    for (let i = 0; i < 100; ++i) {
      job.createBlock('a' + i);
      job.createBlock('b' + i);
    }

    let result1 = await client.listChildren('Connection4', null, 32);
    assert.equal(Object.keys(result1.children).length, 32, 'list should show 32 children');
    assert.equal(result1.count, 200, 'list return number of all children');

    let result2 = await client.listChildren('Connection4', 'a\\d+', 9999);
    assert.equal(Object.keys(result2.children).length, 16, 'list more than 1024, fallback to 16');
    assert.equal(result2.count, 100, 'list return number of filtered children');

    client.destroy();
    Root.instance.setValue('Connection4', null);
  });
});
