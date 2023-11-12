import expect from 'expect';
import {Root} from '../../block/Flow';
import {makeLocalConnection} from '../LocalConnection';
import {AsyncClientPromise} from './AsyncClientPromise';
import {VoidListeners, TestFunctionRunner} from '../../block/spec/TestFunction';
import {FunctionDesc} from '../../block/Descriptor';
import {shouldHappen} from '../../util/test-util';
import {JsFunction} from '../../functions/script/Js';
import {Functions} from '../../block/Functions';
import {DataMap} from '../../util/DataTypes';
import {BaseFunction} from '../../block/BlockFunction';
import {addTestTypes, removeTestTypes} from './BulkTypes';

describe('Connection Message Frames', function () {
  it('desc frames', async function () {
    addTestTypes('a', 4000);
    let [server, client] = makeLocalConnection(Root.instance);

    await shouldHappen(() => client.watchDesc('a100'));

    expect(client.watchDesc('a1000') != null).toBe(true);
    expect(client.watchDesc('a3999') == null).toBe(true);
    await shouldHappen(() => client.watchDesc('a3999'), 500);

    addTestTypes('b', 4000);

    await shouldHappen(() => client.watchDesc('b3999'), 500);

    client.destroy();

    removeTestTypes('a', 4000);
    removeTestTypes('b', 4000);

    expect(Functions.getAllFunctionIds().length < 4000).toBe(true);
  });
});
