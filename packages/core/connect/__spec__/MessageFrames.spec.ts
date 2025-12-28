import {expect} from 'vitest';
import {Root} from '../../block/Flow.js';
import {makeLocalConnection} from '../LocalConnection.js';
import {AsyncClientPromise} from './AsyncClientPromise.js';
import {VoidListeners, TestFunctionRunner} from '../../block/__spec__/TestFunction.js';
import {FunctionDesc} from '../../block/Descriptor.js';
import {shouldHappen} from '../../util/test-util.js';
import {JsFunction} from '../../functions/script/Js.js';
import {Functions} from '../../block/Functions.js';
import {DataMap} from '../../util/DataTypes.js';
import {BaseFunction} from '../../block/BlockFunction.js';
import {addTestTypes, removeTestTypes} from './BulkTypes.js';

describe('Connection Message Frames', function () {
  it('desc frames', async function () {
    addTestTypes('a', 4000);
    const [server, client] = makeLocalConnection(Root.instance);

    await shouldHappen(() => client.watchDesc('a100'));

    expect(client.watchDesc('a1000') != null).toBe(true);
    expect(client.watchDesc('a3999') == null).toBe(true);
    await shouldHappen(() => client.watchDesc('a3999'), 1000);

    addTestTypes('b', 4000);

    await shouldHappen(() => client.watchDesc('b3999'), 1000);

    client.destroy();

    removeTestTypes('a', 4000);
    removeTestTypes('b', 4000);

    expect(Functions.getAllFunctionIds().length < 4000).toBe(true);
  });
});
