import {assert} from 'chai';
import {Root} from '../../block/Block';
import {makeLocalConnection} from '../LocalConnection';
import {AsyncClientPromise} from './AsyncClientPromise';
import {VoidListeners, TestFunctionRunner} from '../../block/spec/TestFunction';
import {FunctionDesc} from '../../block/Descriptor';
import {shouldHappen} from '../../util/test-util';
import {JsFunction} from '../../functions/script/Js';
import {Types} from '../../block/Type';
import {DataMap} from '../../util/Types';
import {PureFunction} from '../../block/BlockFunction';
import {addTestTypes, removeTestTypes} from './BulkTypes';

describe('Connection Message Frames', function() {
  it('desc frames', async function() {
    addTestTypes('a', 4000);
    let [server, client] = makeLocalConnection(Root.instance);

    await shouldHappen(() => client.watchDesc('a100'));

    assert.isNotNull(client.watchDesc('a1000'), 'a1000 should be sent in the same batch as a100');
    assert.isNull(client.watchDesc('a3999'), 'a3999 should be sent in a later frame');
    await shouldHappen(() => client.watchDesc('a3999'));

    addTestTypes('b', 4000);

    await shouldHappen(() => client.watchDesc('b3999'));

    client.destroy();

    removeTestTypes('a', 4000);
    removeTestTypes('b', 4000);

    assert.isTrue(Types.getAllTypeIds().length < 4000, 'removeTestType should clear up the map');
  });
});
