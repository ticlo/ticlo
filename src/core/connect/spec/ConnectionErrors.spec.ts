import {assert} from 'chai';
import {Root} from '../../block/Flow';
import {makeLocalConnection} from '../LocalConnection';
import {AddFunction} from '../../functions/math/Arithmetic';
import {DataMap} from '../../util/DataTypes';
import {AsyncClientPromise} from './AsyncClientPromise';
import {shouldReject} from '../../util/test-util';

const initAdd = AddFunction;

describe('Connection Error', function () {
  it('common errors', async function () {
    let flow = Root.instance.addFlow('ConnectionError1');
    let [server, client] = makeLocalConnection(Root.instance, false);

    assert.equal(
      await shouldReject(client.simpleRequest({cmd: 'invalid_command', path: ''}, null) as Promise<any>),
      'invalid command'
    );
    assert.equal(await shouldReject(client.simpleRequest({cmd: 'get'}, null) as Promise<any>), 'invalid path');

    assert.equal(
      await shouldReject(client.setValue('ConnectionError1.a.b.c', 1, true) as Promise<any>),
      'invalid path'
    );
    assert.equal(
      await shouldReject(client.updateValue('ConnectionError1.a.b.c', 1, true) as Promise<any>),
      'invalid path'
    );
    assert.equal(
      await shouldReject(client.setBinding('ConnectionError1.a.b.c', '1', false, true) as Promise<any>),
      'invalid path'
    );

    assert.equal(await shouldReject(client.getValue('ConnectionError1.a.b.c') as Promise<any>), 'invalid path');

    assert.equal(await shouldReject(client.listChildren('ConnectionError1.a.b.c') as Promise<any>), 'invalid path');

    assert.equal(await shouldReject(client.addBlock('ConnectionError1.a.b.c') as Promise<any>), 'invalid path');

    assert.equal(await shouldReject(client.editWorker('ConnectionError1.a.b.c') as Promise<any>), 'invalid path');

    assert.equal(await shouldReject(client.applyFlowChange('ConnectionError1.a.b.c') as Promise<any>), 'invalid path');

    assert.equal(await shouldReject(client.addFlow('ConnectionError1') as Promise<any>), 'invalid path');

    assert.equal(
      await shouldReject(client.showProps('ConnectionError1.a.b.c', ['@a']) as Promise<any>),
      'invalid path'
    );

    assert.equal(
      await shouldReject(client.hideProps('ConnectionError1.a.b.c', ['@a']) as Promise<any>),
      'invalid path'
    );

    assert.equal(
      await shouldReject(client.showProps('ConnectionError1.a.b.c', null) as Promise<any>),
      'invalid properties'
    );

    assert.equal(
      await shouldReject(client.hideProps('ConnectionError1.a.b.c', null) as Promise<any>),
      'invalid properties'
    );

    assert.equal(await shouldReject(client.addCustomProp('a', null) as Promise<any>), 'invalid desc');
    assert.equal(
      await shouldReject(
        client.addCustomProp('ConnectionError1.a.b.c', {
          name: 'a',
          type: 'string',
        }) as Promise<any>
      ),
      'invalid path'
    );
    assert.equal(
      await shouldReject(client.removeCustomProp('ConnectionError1.a.b.c', 'a') as Promise<any>),
      'invalid path'
    );
    assert.equal(
      await shouldReject(client.moveCustomProp('ConnectionError1.a.b.c', 'a', 'b') as Promise<any>),
      'invalid path'
    );

    assert.equal(await shouldReject(client.addOptionalProp('a', null) as Promise<any>), 'invalid path');
    assert.equal(
      await shouldReject(client.addOptionalProp('ConnectionError1.a.b.c', 'a') as Promise<any>),
      'invalid path'
    );
    assert.equal(
      await shouldReject(client.removeOptionalProp('ConnectionError1.a.b.c', 'a') as Promise<any>),
      'invalid path'
    );
    assert.equal(
      await shouldReject(client.moveOptionalProp('ConnectionError1.a.b.c', 'a', 'b') as Promise<any>),
      'invalid path'
    );

    assert.equal(await shouldReject(client.setLen('ConnectionError1.a.b', '', null) as Promise<any>), 'invalid path');
    assert.equal(
      await shouldReject(client.insertGroupProp('ConnectionError1.a.b.c', '', 0) as Promise<any>),
      'invalid path'
    );
    assert.equal(
      await shouldReject(client.removeGroupProp('ConnectionError1.a.b.c', '', 0) as Promise<any>),
      'invalid path'
    );
    assert.equal(
      await shouldReject(client.moveGroupProp('ConnectionError1.a.b.c', '', 0, 1) as Promise<any>),
      'invalid path'
    );

    assert.equal(await shouldReject(client.undo('ConnectionError1.a.b.c') as Promise<any>), 'invalid path');
    assert.equal(await shouldReject(client.redo('ConnectionError1.a.b.c') as Promise<any>), 'invalid path');

    assert.equal(await shouldReject(client.copy('ConnectionError1.a', ['add']) as Promise<any>), 'invalid path');
    assert.equal(
      await shouldReject(client.paste('ConnectionError1.a', {add: {'#is': 'add'}}) as Promise<any>),
      'invalid path'
    );

    let callbacks = new AsyncClientPromise();
    client.watch('ConnectionError1.a.b.c', callbacks);
    assert.equal(await shouldReject(callbacks.promise), 'invalid path');

    client.destroy();
    Root.instance.deleteValue('ConnectionError1');
  });

  it('parent removed', async function () {
    let flow = Root.instance.addFlow('ConnectionError2');
    let [server, client] = makeLocalConnection(Root.instance, false);
    let a = flow.createBlock('a');
    let b = a.createBlock('b');
    // bind c to b
    a.setBinding('c', 'b');

    let callbacks1 = new AsyncClientPromise();
    client.subscribe('ConnectionError2.a.b', callbacks1);

    let callbacks2 = new AsyncClientPromise();
    client.watch('ConnectionError2.a.b', callbacks2);

    let callbacks3 = new AsyncClientPromise();
    client.watch('ConnectionError2.a.c', callbacks3);

    // wait for first response
    await Promise.all([callbacks1.promise, callbacks2.promise, callbacks3.promise]);

    a.createBlock('c');
    let result3 = await shouldReject(callbacks3.promise);
    assert.equal(result3, 'block changed', 'watch error when block changed');
    client.unwatch('ConnectionError2.a.c', callbacks3);

    flow.setValue('a', null);

    let [result1, result2] = await Promise.all([shouldReject(callbacks1.promise), shouldReject(callbacks2.promise)]);

    assert.equal(result1, 'source changed', 'subscribe error when parent destroyed');
    assert.equal(result2, 'source changed', 'watch error when parent destroyed');

    // clean up
    callbacks1.cancel();
    callbacks2.cancel();
    callbacks3.cancel();
    client.destroy();
    Root.instance.deleteValue('ConnectionError2');
  });
});
