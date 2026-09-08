import {expect} from 'vitest';
import {Root} from '../../block/Flow.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import {AsyncClientPromise} from './AsyncClientPromise.ts';
import {VoidListeners, TestFunctionRunner} from '../../block/__spec__/TestFunction.ts';
import {FunctionDesc} from '../../block/Descriptor.ts';
import {shouldHappen} from '../../util/test-util.ts';
import {JsFunction} from '../../functions/script/Js.ts';
import {globalFunctions} from '../../block/FunctionLib.ts';
import {DataMap} from '../../util/DataTypes.ts';
import {BaseFunction} from '../../block/BlockFunction.ts';
import {addTestTypes, removeTestTypes} from './BulkTypes.ts';

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

    expect(globalFunctions.getAllFunctionIds().length < 4000).toBe(true);
  });
});
