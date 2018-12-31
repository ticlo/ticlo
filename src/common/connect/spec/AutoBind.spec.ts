import {assert} from "chai";
import {Root} from "../../block/Block";
import {makeLocalConnection} from "../LocalConnection";
import "../../functions/basic/Math";
import {AsyncClientPromise} from "./AsyncClientPromise";
import {VoidListeners, TestFunctionRunner} from "../../block/spec/TestFunction";
import {FunctionDesc} from "../../block/Descriptor";
import {shouldHappen} from "../../util/test-util";
import {JsFunction} from "../../functions/script/Js";
import {Types} from "../../block/Type";
import {DataMap} from "../../util/Types";
import {WorkerFunction} from "../../worker/WorkerFunction";


describe("AutoBinding", function () {

  it('auto binding', async function () {
    let job1 = Root.instance.addJob('AutoBinding1');
    let job2 = Root.instance.addJob('AutoBinding2');

    let jobData: DataMap = {
      '#is': '',
      'a': {
        '#is': '', 'b': {'#is': ''}
      }
    };
    WorkerFunction.registerType(jobData, {name: 'class1'}, 'AutoBinding');

    job1.load({
      'c': {
        '#is': '',
        'd': {'#is': 'AutoBinding:class1'},
        'e': {'#is': ''}
      },
      'f': {
        '#is': ''
      }
    });

    job2.load({
      'o': {
        '#is': '',
        'p': {'#is': 'AutoBinding:class1'},
        'q': {'#is': ''}
      }
    });

    let [server, client] = makeLocalConnection(Root.instance, false);

    // auto binding with in same job
    client.setBinding('AutoBinding1.c.e.v1', 'AutoBinding1.c.d.v1', true);
    client.setBinding('AutoBinding1.c.e.v2', 'AutoBinding1.c.e.v1', true);
    client.setBinding('AutoBinding1.c.e.v3', 'AutoBinding1.f.v3', true);
    client.setBinding('AutoBinding1.c.v4', 'AutoBinding1.f.v4', true);

    await shouldHappen(() => job1.queryProperty('c.e.v2', true)._bindingPath === 'v1');
    await shouldHappen(() => job1.queryProperty('c.e.v1', true)._bindingPath === '##.d.v1');
    await shouldHappen(() => job1.queryProperty('c.e.v3', true)._bindingPath === '###.f.v3');
    await shouldHappen(() => job1.queryProperty('c.v4', true)._bindingPath === '##.f.v4');
    
    client.destroy();
    Root.instance.deleteValue('AutoBinding1');
    Root.instance.deleteValue('AutoBinding2');
  });
});
