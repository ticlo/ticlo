import {expect} from 'vitest';
import {Root} from '@ticlo/core/block/Flow.ts';
import {AsyncClientPromise} from '@ticlo/core/connect/__spec__/AsyncClientPromise.ts';
import {shouldHappen, shouldReject} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '@ticlo/editor';
import {MockWsServer} from './MockWsServer.ts';
import {WsClientConnection} from '../WsClientConnection.ts';
import {Logger} from '@ticlo/core/util/Logger.ts';
import {addTestTypes, removeTestTypes} from '@ticlo/core/connect/__spec__/BulkTypes.ts';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {FunctionDesc} from '@ticlo/core/block/Descriptor.ts';
import {globalFunctions} from '@ticlo/core/block/FunctionLib.ts';

const PORT = 8082;

// @ts-ignore
const beforeAll = globalThis.beforeAll ?? globalThis.before;
// @ts-ignore
const afterAll = globalThis.afterAll ?? globalThis.after;

describe('WsConnect', function () {
  let server: MockWsServer;
  beforeAll(async function () {
    try {
      server = new MockWsServer(PORT);
    } catch (err) {
      console.log(err);
    }

    await server.init();
  });

  afterAll(function () {
    server.close();
  });

  it('reconnect', async function () {
    const flow = Root.instance.addFlow('WsConnect1');
    const client = new WsClientConnection(`ws://127.0.0.1:${PORT}`, false);

    flow.setValue('o', 1);
    flow.setBinding('a', 'o');

    const subcallbacks = new AsyncClientPromise();
    client.subscribe('WsConnect1.a', subcallbacks);
    let result = await subcallbacks.promise;
    expect(result.cache.value).toBe(1);

    const setcallbacks = new AsyncClientPromise();
    client.setValue('WsConnect1.a', 3, setcallbacks);

    const promiseReject = shouldReject(setcallbacks.promise);

    server.lastConnection._ws.close(1000); // close ws froms erver side

    await promiseReject; // setValue should receive error

    flow.setValue('a', 2);
    result = await subcallbacks.promise;
    expect(result.cache.value).toBe(2);
    expect(result.cache.bindingPath).toBeNull();
    expect(result.change.bindingPath).toBeNull();

    // clean up
    subcallbacks.cancel();
    client.destroy();
    Root.instance.deleteValue('WsConnect1');
  });

  it('desc frames', async function () {
    addTestTypes('A', 4000);
    const client = new WsClientConnection(`ws://127.0.0.1:${PORT}`, true);

    await shouldHappen(() => client.watchDesc('A100'));

    expect(client.watchDesc('A1000') != null).toBe(true);
    expect(client.watchDesc('A3999') == null).toBe(true);
    await shouldHappen(() => client.watchDesc('A3999'), 2500);

    addTestTypes('B', 4000);

    await shouldHappen(() => client.watchDesc('B3999'), 2500);

    client.destroy();

    removeTestTypes('A', 4000);
    removeTestTypes('B', 4000);
  });
});
