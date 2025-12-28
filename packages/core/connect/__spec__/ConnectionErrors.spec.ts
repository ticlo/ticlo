import {expect} from 'vitest';
import {Root} from '../../block/Flow.js';
import {makeLocalConnection} from '../LocalConnection.js';
import {AddFunction} from '../../functions/math/Arithmetic.js';
import {DataMap} from '../../util/DataTypes.js';
import {AsyncClientPromise} from './AsyncClientPromise.js';
import {shouldReject} from '../../util/test-util.js';

const initAdd = AddFunction;

describe('Connection Error', function () {
  it('common errors', async function () {
    const flow = Root.instance.addFlow('ConnectionError1');
    flow.createBlock('validChild');
    const [server, client] = makeLocalConnection(Root.instance, false);

    expect(await shouldReject(client.simpleRequest({cmd: 'invalid_command', path: ''}))).toEqual('invalid command');
    expect(await shouldReject(client.simpleRequest({cmd: 'get'}))).toBe('invalid path');

    expect(await shouldReject(client.setValue('ConnectionError1.a.b.c', 1, true) as Promise<any>)).toEqual(
      'invalid path'
    );
    expect(await shouldReject(client.updateValue('ConnectionError1.a.b.c', 1, true) as Promise<any>)).toEqual(
      'invalid path'
    );
    expect(await shouldReject(client.setBinding('ConnectionError1.a.b.c', '1', false, true) as Promise<any>)).toEqual(
      'invalid path'
    );

    expect(await shouldReject(client.getValue('ConnectionError1.a.b.c') as Promise<any>)).toBe('invalid path');

    expect(await shouldReject(client.list('ConnectionError1.a.b.c') as Promise<any>)).toBe('invalid path');

    expect(await shouldReject(client.addBlock('ConnectionError1.a.b.c') as Promise<any>)).toBe('invalid path');

    expect(typeof (await client.addBlock('ConnectionError1.#inputs', {'#is': 'flow:inputs'}))).toBe('object');
    // Can not create #inputs again
    expect(
      await shouldReject(client.addBlock('ConnectionError1.#inputs', {'#is': 'flow:inputs'}) as Promise<any>)
    ).toBe('invalid path');
    expect(typeof (await client.addBlock('ConnectionError1.#outputs', {'#is': 'flow:outputs'}))).toBe('object');
    // Can not create #outputs again
    expect(
      await shouldReject(client.addBlock('ConnectionError1.#outputs', {'#is': 'flow:outputs'}) as Promise<any>)
    ).toBe('invalid path');

    expect(
      await shouldReject(
        client.addBlock('ConnectionError1.#invalidFunction', {'#is': 'flow:invalidFunction'}) as Promise<any>
      )
    ).toBe('invalid function');

    expect(await shouldReject(client.editWorker('ConnectionError1.a.b.c') as Promise<any>)).toBe('invalid path');

    expect(await shouldReject(client.applyFlowChange('ConnectionError1.a.b.c') as Promise<any>)).toEqual(
      'invalid path'
    );

    expect(await shouldReject(client.addFlow('ConnectionError1') as Promise<any>)).toBe('invalid path');

    expect(await shouldReject(client.showProps('ConnectionError1.a.b.c', ['@a']) as Promise<any>)).toEqual(
      'invalid path'
    );

    expect(await shouldReject(client.hideProps('ConnectionError1.a.b.c', ['@a']) as Promise<any>)).toEqual(
      'invalid path'
    );

    expect(await shouldReject(client.showProps('ConnectionError1.a.b.c', null) as Promise<any>)).toEqual(
      'invalid properties'
    );

    expect(await shouldReject(client.hideProps('ConnectionError1.a.b.c', null) as Promise<any>)).toEqual(
      'invalid properties'
    );

    expect(await shouldReject(client.addCustomProp('a', null) as Promise<any>)).toBe('invalid desc');
    expect(
      await shouldReject(
        client.addCustomProp('ConnectionError1.a.b.c', {
          name: 'a',
          type: 'string',
        }) as Promise<any>
      )
    ).toBe('invalid path');
    expect(await shouldReject(client.removeCustomProp('ConnectionError1.a.b.c', 'a') as Promise<any>)).toEqual(
      'invalid path'
    );
    expect(await shouldReject(client.moveCustomProp('ConnectionError1.a.b.c', 'a', 'b') as Promise<any>)).toEqual(
      'invalid path'
    );

    expect(await shouldReject(client.addOptionalProp('a', null) as Promise<any>)).toBe('invalid path');
    expect(await shouldReject(client.addOptionalProp('ConnectionError1.a.b.c', 'a') as Promise<any>)).toEqual(
      'invalid path'
    );
    expect(await shouldReject(client.removeOptionalProp('ConnectionError1.a.b.c', 'a') as Promise<any>)).toEqual(
      'invalid path'
    );
    expect(await shouldReject(client.moveOptionalProp('ConnectionError1.a.b.c', 'a', 'b') as Promise<any>)).toEqual(
      'invalid path'
    );

    expect(await shouldReject(client.setLen('ConnectionError1.a.b', '', null) as Promise<any>)).toBe('invalid path');
    expect(await shouldReject(client.insertGroupProp('ConnectionError1.a.b.c', '', 0) as Promise<any>)).toEqual(
      'invalid path'
    );
    expect(await shouldReject(client.removeGroupProp('ConnectionError1.a.b.c', '', 0) as Promise<any>)).toEqual(
      'invalid path'
    );
    expect(await shouldReject(client.moveGroupProp('ConnectionError1.a.b.c', '', 0, 1) as Promise<any>)).toEqual(
      'invalid path'
    );

    expect(await shouldReject(client.undo('ConnectionError1.a.b.c') as Promise<any>)).toBe('invalid path');
    expect(await shouldReject(client.redo('ConnectionError1.a.b.c') as Promise<any>)).toBe('invalid path');

    expect(await shouldReject(client.copy('ConnectionError1.a', ['add']) as Promise<any>)).toBe('invalid path');
    expect(await shouldReject(client.paste('ConnectionError1.a', {add: {'#is': 'add'}}) as Promise<any>)).toEqual(
      'invalid path'
    );

    expect(await shouldReject(client.callFunction('ConnectionError1.a') as Promise<any>)).toBe('invalid path');

    expect(await shouldReject(client.executeCommand('ConnectionError1.a.b.c', 'test', {}) as Promise<any>)).toEqual(
      'invalid path'
    );

    expect(await shouldReject(client.restoreSaved('ConnectionError1.a.b.c') as Promise<any>)).toBe('invalid path');

    const callbacks = new AsyncClientPromise();
    client.watch('ConnectionError1.a.b.c', callbacks);
    expect(await shouldReject(callbacks.promise)).toBe('invalid path');

    client.destroy();
    Root.instance.deleteValue('ConnectionError1');
  });

  it('parent removed', async function () {
    const flow = Root.instance.addFlow('ConnectionError2');
    const [server, client] = makeLocalConnection(Root.instance, false);
    const a = flow.createBlock('a');
    const b = a.createBlock('b');
    // bind c to b
    a.setBinding('c', 'b');

    const callbacks1 = new AsyncClientPromise();
    client.subscribe('ConnectionError2.a.b', callbacks1);

    const callbacks2 = new AsyncClientPromise();
    client.watch('ConnectionError2.a.b', callbacks2);

    const callbacks3 = new AsyncClientPromise();
    client.watch('ConnectionError2.a.c', callbacks3);

    // wait for first response
    await Promise.all([callbacks1.promise, callbacks2.promise, callbacks3.promise]);

    a.createBlock('c');
    const result3 = await shouldReject(callbacks3.promise);
    expect(result3).toBe('block changed');
    client.unwatch('ConnectionError2.a.c', callbacks3);

    flow.setValue('a', null);

    const [result1, result2] = await Promise.all([shouldReject(callbacks1.promise), shouldReject(callbacks2.promise)]);

    expect(result1).toBe('source changed');
    expect(result2).toBe('source changed');

    // clean up
    callbacks1.cancel();
    callbacks2.cancel();
    callbacks3.cancel();
    client.destroy();
    Root.instance.deleteValue('ConnectionError2');
  });
});
