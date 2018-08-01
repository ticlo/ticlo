import {assert} from "chai";
import {Job, Root} from "../../block/Job";
import {Block} from "../../block/Block";
import {TestFunctionRunner, TestAsyncFunctionPromise} from "../../block/spec/TestFunction";
import "../../functions/basic/Math";
import "../MapFunction";
import {DataMap} from "../../util/Types";


describe("MapFunction Thread", () => {

  let inputObj: any = {};
  let inputArr: any[] = [];

  for (let i = 0; i < 20; ++i) {
    inputObj['v' + i] = i;
    inputArr.push(i + 100);
  }

  it('basic', async () => {
    TestFunctionRunner.clearLog();
    let job = new Job();

    job.setValue('a', inputObj);

    let bBlock = job.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'thread': 5,
      '~input': '##.a',
      'src': {
        '#is': {
          '#is': '',
          'add': {'#is': 'add', '~0': '##.#input', '1': 1},
          '~#output': 'add.output'
        }
      }
    });

    Root.run();
    assert.isUndefined(bBlock.getValue('output'), 'async worker should not finish right after run');

    let output = await bBlock.waitValue('output');
    assert.lengthOf(Object.keys(output), 20);

    for (let i = 0; i < 20; ++i) {
      assert.equal(output['v' + i], i + 1);
    }
    job.setValue('a', {
      'v1': 1,
      'v2': 4,
      'v4': 5
    });

    output = await bBlock.waitNextValue('output');

    assert.deepEqual(output, {'v1': 2, 'v2': 5, 'v4': 6}, 'input change');

    job.setValue('a', inputArr);
    let outputArr = await bBlock.waitNextValue('output');
    assert.lengthOf(outputArr, 20, 'output array');

    for (let i = 0; i < 20; ++i) {
      assert.equal(outputArr[i], i + 101);
    }
  });

});
