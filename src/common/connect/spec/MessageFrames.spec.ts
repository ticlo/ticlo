import {assert} from "chai";
import {Root} from "../../block/Block";
import {makeLocalConnection} from "../LocalConnection";
import {AsyncClientPromise} from "./AsyncClientPromise";
import {VoidListeners, TestFunctionRunner} from "../../block/spec/TestFunction";
import {FunctionDesc} from "../../block/Descriptor";
import {shouldHappen} from "../../util/test-util";
import {JsFunction} from "../../functions/script/Js";
import {Types} from "../../block/Type";
import {DataMap} from "../../util/Types";
import {PureFunction} from "../../block/BlockFunction";


class TestFunction extends PureFunction {
}

TestFunction.prototype.priority = 0;
TestFunction.prototype.useLength = false;

let testDesc = {
  name: '',
  icon: 'fas:plus',
  useLength: true,
  inputs: [
    {name: 'a', type: 'number', visible: 'high'},
    {name: 'b', type: 'number', visible: 'high'},
    {name: 'c', type: 'number', visible: 'high'},
    {name: 'd', type: 'number', visible: 'high'}
  ],
  outputs: [
    {name: 'output', type: 'number'}
  ],
};

function addTestTypes(prefix: string, count: number) {
  for (let i = 0; i < count; ++i) {
    Types.add(TestFunction, {...testDesc, name: `${prefix}${i}`} as any);
  }
}

function removeTestTypes(prefix: string, count: number) {
  for (let i = 0; i < count; ++i) {
    Types.clear(`${prefix}${i}`);
  }
}

describe("Connection Message Frames", function () {
  it('desc frames', async function () {
    addTestTypes('a', 4000);
    let [server, client] = makeLocalConnection(Root.instance);

    let callbacks = new AsyncClientPromise();
    let a100 = await new Promise((resolve, reject) => {
      client.watchDesc('a100', (desc: FunctionDesc) => {
        if (desc) {
          resolve(desc);
        }
      });
    });

    let a1000: FunctionDesc = null;
    client.watchDesc('a1000', (desc: FunctionDesc) => {
      if (desc) {
        a1000 = desc;
      }
    });
    assert.isNotNull(a1000, 'a1000 should be sent in the same batch as a100');

    let a3999: FunctionDesc = null;
    let promise3999 = new Promise((resolve, reject) => {
      client.watchDesc('a3999', (desc: FunctionDesc) => {
        if (desc) {
          a3999 = desc;
          resolve(desc);
        }
      });
    });

    assert.isNull(a3999, 'a3999 should be sent in a later frame');

    await promise3999;

    addTestTypes('b', 4000);

    let b3999 = await new Promise((resolve, reject) => {
      client.watchDesc('b3999', (desc: FunctionDesc) => {
        if (desc) {
          resolve(desc);
        }
      });
    });

    client.destroy();

    removeTestTypes('a', 4000);
    removeTestTypes('b', 4000);

    assert.isTrue(Types.getAllTypeIds().length < 4000, 'removeTestType should clear up the map');
  });
});
