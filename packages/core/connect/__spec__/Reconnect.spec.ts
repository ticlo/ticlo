import {expect} from 'vitest';
import {Block} from '../../block/Block.ts';
import {Root} from '../../block/Flow.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import '../../functions/math/Arithmetic.ts';
import {AsyncClientPromise} from './AsyncClientPromise.ts';
import {shouldHappen, shouldReject} from '../../util/test-util.ts';
import {JsFunction} from '../../functions/script/Js.ts';
import {FunctionDesc} from '../../block/Descriptor.ts';
import {globalFunctions} from '../../block/FunctionLib.ts';
import {Logger} from '../../util/Logger.ts';

describe('Reconnect', function () {
  it('reconnect', async function () {
    const flow = Root.instance.addFlow('Reconnect1');
    const [server, client] = makeLocalConnection(Root.instance, false);

    flow.setValue('o', 1);
    flow.setBinding('a', 'o');

    const subcallbacks = new AsyncClientPromise();
    client.subscribe('Reconnect1.a', subcallbacks);
    let result = await subcallbacks.promise;
    expect(result.cache.value).toBe(1);

    const setcallbacks = new AsyncClientPromise();
    client.setValue('Reconnect1.a', 3, setcallbacks);

    const promiseReject = shouldReject(setcallbacks.promise);
    client.onDisconnect();
    await promiseReject; // setValue should receive error

    flow.setValue('a', 2);
    result = await subcallbacks.promise;
    expect(result.cache.value).toBe(2);
    expect(result.cache.bindingPath).toBeNull();
    expect(result.change.bindingPath).toBeNull();

    // clean up
    subcallbacks.cancel();
    client.destroy();
    Root.instance.deleteValue('Reconnect1');
  });

  it('watch object after reconnect ', async function () {
    const flow = Root.instance.addFlow('Reconnect2');
    const [server, client] = makeLocalConnection(Root.instance, false);

    const child0 = flow.createBlock('c0');
    const child1 = flow.createBlock('c1');

    const callbacks1 = new AsyncClientPromise();
    client.watch('Reconnect2', callbacks1);
    const result1 = await callbacks1.promise;
    expect(result1.cache).toEqual({
      c0: child0._blockId,
      c1: child1._blockId,
    });

    client.onDisconnect();

    const child2 = flow.createBlock('c2');
    flow.deleteValue('c1');

    const result2 = await callbacks1.promise;
    expect(result2.cache).toEqual({
      c0: child0._blockId,
      c2: child2._blockId,
    });
    expect(result2.changes).toEqual({c1: null, c2: child2._blockId});

    // clean up
    callbacks1.cancel();
    client.destroy();
    Root.instance.deleteValue('Reconnect2');
  });

  it('watch desc after reconnect ', async function () {
    const flow = Root.instance.addFlow('Reconnect3');
    const [server, client] = makeLocalConnection(Root.instance, true);

    JsFunction.registerType('', {name: 'ReconnectType1'});
    await shouldHappen(() => client.watchDesc('ReconnectType1'));

    client.onDisconnect();

    JsFunction.registerType('', {name: 'ReconnectType2'});
    globalFunctions.delete('ReconnectType1');

    await shouldHappen(() => client.watchDesc('ReconnectType2'), 1500);
    await shouldHappen(() => client.watchDesc('ReconnectType1') == null);

    globalFunctions.delete('ReconnectType2');

    client.destroy();
    Root.instance.deleteValue('Reconnect3');
  });
});
