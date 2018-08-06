import {assert} from "chai";
import {Root} from "../../block/Block";
import {makeLocalConnection} from "../LocalConnection";
import {AddFunction} from "../../functions/basic/Math";
import {DataMap} from "../../util/Types";
import {AsyncClientPromise} from "./AsyncClientPromise";

const initAdd = AddFunction;

describe("Connection Error", () => {
  it('parent removed', async () => {
    let job = Root.instance.addJob('ConnectionError1');
    let [server, client] = makeLocalConnection(Root.instance);
    let a = job.createBlock('a');
    let b = a.createBlock('b');
    // bind c to b
    a.setBinding('c', 'b');

    let callbacks1 = new AsyncClientPromise();
    client.subscribe('ConnectionError1.a.b', callbacks1);

    let callbacks2 = new AsyncClientPromise();
    client.watch('ConnectionError1.a.b', callbacks2);

    let callbacks3 = new AsyncClientPromise();
    client.watch('ConnectionError1.a.c', callbacks3);

    // wait for first response
    await Promise.all([callbacks1.promise, callbacks2.promise, callbacks3.promise]);

    a.createBlock('c');
    let result3 = await callbacks3.promise;
    assert.instanceOf(result3, Error, 'watch error when block changed');
    client.unwatch('ConnectionError1.a.c', callbacks3);

    job.setValue('a', null);

    let [result1, result2] = await Promise.all([callbacks1.promise, callbacks2.promise]);

    assert.instanceOf(result1, Error, 'subscribe error when parent destroyed');
    assert.instanceOf(result2, Error, 'watch error when parent destroyed');

    // clean up
    callbacks1.cancel();
    callbacks2.cancel();
    callbacks3.cancel();
    client.destroy();
    Root.instance.setValue('ConnectionError1', null);
  });
});
