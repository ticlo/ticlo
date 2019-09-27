import {assert} from 'chai';
import {Block, Root} from '../../block/Block';
import {makeLocalConnection} from '../LocalConnection';
import '../../functions/basic/math/Arithmetic';
import {AsyncClientPromise} from './AsyncClientPromise';
import {shouldHappen, shouldReject} from '../../util/test-util';
import {JsFunction} from '../../functions/script/Js';
import {FunctionDesc} from '../../block/Descriptor';
import {Types} from '../../block/Type';
import {Logger} from '../../util/Logger';

describe('Reconnect', function() {
  it('reconnect', async function() {
    let job = Root.instance.addJob('Reconnect1');
    let [server, client] = makeLocalConnection(Root.instance, false);

    job.setValue('o', 1);
    job.setBinding('a', 'o');

    let subcallbacks = new AsyncClientPromise();
    client.subscribe('Reconnect1.a', subcallbacks);
    let result = await subcallbacks.promise;
    assert.equal(result.cache.value, 1);

    let setcallbacks = new AsyncClientPromise();
    client.setValue('Reconnect1.a', 3, setcallbacks);

    let promiseReject = shouldReject(setcallbacks.promise);
    client.onDisconnect();
    await promiseReject; // setValue should receive error

    job.setValue('a', 2);
    result = await subcallbacks.promise;
    assert.equal(result.cache.value, 2);
    assert.isNull(result.cache.bindingPath);
    assert.isNull(result.change.bindingPath);

    // clean up
    subcallbacks.cancel();
    client.destroy();
    Root.instance.deleteValue('Reconnect1');
  });

  it('watch object after reconnect ', async function() {
    let job = Root.instance.addJob('Reconnect2');
    let [server, client] = makeLocalConnection(Root.instance, false);

    let child0 = job.createBlock('c0');
    let child1 = job.createBlock('c1');

    let callbacks1 = new AsyncClientPromise();
    client.watch('Reconnect2', callbacks1);
    let result1 = await callbacks1.promise;
    assert.deepEqual(result1.cache, {
      c0: child0._blockId,
      c1: child1._blockId
    });

    client.onDisconnect();

    let child2 = job.createBlock('c2');
    job.deleteValue('c1');

    let result2 = await callbacks1.promise;
    assert.deepEqual(result2.cache, {
      c0: child0._blockId,
      c2: child2._blockId
    });
    assert.deepEqual(result2.changes, {c1: null, c2: child2._blockId});

    // clean up
    callbacks1.cancel();
    client.destroy();
    Root.instance.deleteValue('Reconnect2');
  });

  it('watch desc after reconnect ', async function() {
    let job = Root.instance.addJob('Reconnect3');
    let [server, client] = makeLocalConnection(Root.instance, true);

    JsFunction.registerType('', {name: 'ReconnectType1'});
    await shouldHappen(() => client.watchDesc('ReconnectType1'));

    client.onDisconnect();

    JsFunction.registerType('', {name: 'ReconnectType2'});
    Types.clear('ReconnectType1');

    await shouldHappen(() => client.watchDesc('ReconnectType2'), 1500);
    await shouldHappen(() => client.watchDesc('ReconnectType1') == null);

    Types.clear('ReconnectType2');

    client.destroy();
    Root.instance.deleteValue('Reconnect3');
  });
});
