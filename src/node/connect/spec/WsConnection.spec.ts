import {assert} from 'chai';
import {Root} from '../../../core/block/Flow';
import {AsyncClientPromise} from '../../../core/connect/spec/AsyncClientPromise';
import {shouldHappen, shouldReject} from '../../../core/util/test-util';
import {initEditor} from '../../../editor';
import {MockWsServer} from './MockWsServer';
import {WsClientConnection} from '../WsClientConnection';
import {Logger} from '../../../core/util/Logger';
import {addTestTypes, removeTestTypes} from '../../../core/connect/spec/BulkTypes';
import {makeLocalConnection} from '../../../core/connect/LocalConnection';
import {FunctionDesc} from '../../../core/block/Descriptor';
import {Functions} from '../../../core/block/Functions';

const PORT = 8082;

describe('WsConnect', function () {
  let server: MockWsServer;
  before(async function () {
    server = new MockWsServer(PORT);
    await server.init();
  });

  after(function () {
    server.close();
  });

  it('reconnect', async function () {
    let flow = Root.instance.addFlow('WsConnect1');
    let client = new WsClientConnection(`http://127.0.0.1:${PORT}`, false);

    flow.setValue('o', 1);
    flow.setBinding('a', 'o');

    let subcallbacks = new AsyncClientPromise();
    client.subscribe('WsConnect1.a', subcallbacks);
    let result = await subcallbacks.promise;
    assert.equal(result.cache.value, 1);

    let setcallbacks = new AsyncClientPromise();
    client.setValue('WsConnect1.a', 3, setcallbacks);

    let promiseReject = shouldReject(setcallbacks.promise);

    server.lastConnection._ws.close(1000); // close ws froms erver side

    await promiseReject; // setValue should receive error

    flow.setValue('a', 2);
    result = await subcallbacks.promise;
    assert.equal(result.cache.value, 2);
    assert.isNull(result.cache.bindingPath);
    assert.isNull(result.change.bindingPath);

    // clean up
    subcallbacks.cancel();
    client.destroy();
    Root.instance.deleteValue('WsConnect1');
  });

  it('desc frames', async function () {
    addTestTypes('A', 4000);
    let client = new WsClientConnection(`http://127.0.0.1:${PORT}`, true);

    await shouldHappen(() => client.watchDesc('A100'));

    assert.isTrue(client.watchDesc('A1000') != null, 'A1000 should be sent in the same batch as A100');
    assert.isTrue(client.watchDesc('A3999') == null, 'A3999 should be sent in a later frame');
    await shouldHappen(() => client.watchDesc('A3999'), 2500);

    addTestTypes('B', 4000);

    await shouldHappen(() => client.watchDesc('B3999'), 2500);

    client.destroy();

    removeTestTypes('A', 4000);
    removeTestTypes('B', 4000);
  });
});
