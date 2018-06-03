import { assert } from "chai";
import { Root } from "../../block/Job";
import { makeLocalConnection } from "../LocalConnection";
import { AddFunction } from "../../functions/basic/Math";
import { DataMap } from "../../util/Types";

const initAdd = AddFunction;

describe("Connection", () => {

  it('basic', async function () {
    let job = Root.instance.addJob('job1');
    let [server, client] = makeLocalConnection(Root.instance);

    await client.createBlock('job1.block1');
    await client.setValue('job1.block1.#is', 'add');
    assert.equal(job.queryProperty("block1.#is").getValue(), 'add', 'basic set');

    let subscribeCallbacks: DataMap;
    let subscribePromise = new Promise<DataMap>(function (resolve, reject) {
      subscribeCallbacks = {
        onUpdate: resolve, onError: reject
      };
    });
    client.subscribe('job1.block1.output', subscribeCallbacks);
    client.setValue('job1.block1.0', 2);
    client.setValue('job1.block1.1', 3);

    let result = await subscribePromise;
    console.log(result);
  });

});