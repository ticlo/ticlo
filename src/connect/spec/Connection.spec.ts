import { assert } from "chai";
import { Root } from "../../block/Job";
import { makeLocalConnection } from "../LocalConnection";
import { AddFunction } from "../../functions/basic/Math";
import { DataMap } from "../../util/Types";
import { AsyncClientPromise } from "./AsyncClientPromise";

const initAdd = AddFunction;

describe("Connection", () => {

  it('basic', async function () {
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
    client.setValue('job1.block1.1', 3);
    result = await callbacks.promise;
    assert.equal(result.value, 5, 'subscribe basic logic result');

    // clean up
    callbacks.cancel();
    client.destroy();
    Root.instance.setValue('job1', null);
  });

  it('binding', async function () {
    let job = Root.instance.addJob('job2');
    let [server, client] = makeLocalConnection(Root.instance);

    let callbacks = new AsyncClientPromise();
    client.subscribe('job2.p', callbacks);
    let result = await callbacks.promise;
    assert.equal(result.value, null, 'initial value');
    assert.equal(result.bindingPath, null, 'initial binding');

    client.setValue('job2.p0', 'hello');
    client.setBinding('job2.p', 'p0');
    result = await callbacks.promise;
    assert.equal(result.value, 'hello', 'change value');
    assert.equal(result.bindingPath, 'p0', 'change binding');

    let cachedPromise = callbacks.promise;

    client.unsubscribe('job2.p', callbacks);

    client.setValue('job2.p1', 'world');
    await client.setBinding('job2.p', 'p1');
    assert.equal(callbacks.promise, cachedPromise, "promise shouldn't be updated after unsubscribe");
  });

});