import {assert} from "chai";
import {Job, Root} from "../../block/Job";
import {Block} from "../../block/Block";
import {TestFunctionRunner} from "../../block/spec/TestFunction";
import "../../functions/basic/Math";
import "../MapFunction";
import {DataMap} from "../../util/Types";

describe("MapFunction", () => {

  it('chain block', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');
    let bBlock = job.createBlock('b');
    let cBlock = job.createBlock('c');
    aBlock._load({
      '#is': '',
      'obj1': {'#is': '', 'v': 1},
      'obj2': {'#is': '', 'v': 2},
      'obj3': {'v': 3}
    });
    bBlock._load({
      '#is': 'map',
      '~$input': '##.a',
      '$src': {
        '#is': {
          '#is': '',
          'add': {'#is': 'add', '~0': '##.#input.v', '1': 1},
          '#output': {'#is': 'output', '~v': '##.add.output'}
        }
      }
    });
    cBlock._load({
      '#is': 'map',
      '~$input': '##.b.$output',
      '$src': {
        '#is': {
          '#is': '',
          'multiply': {'#is': 'multiply', '~0': '##.#input.v', '1': 2},
          '#output': {'#is': 'output', '~v': '##.multiply.output'}
        }
      }
    });
    Root.run();

    assert.equal(bBlock.queryProperty('$output.obj1.v').getValue(), 2, 'basic Map chain');
    assert.equal(cBlock.queryProperty('$output.obj2.v').getValue(), 6, 'basic Map chain');
    assert.equal(cBlock.queryProperty('$output.obj3.v').getValue(), 8, 'basic Map chain on child Object');

    bBlock.updateValue('$src', {
      '#is': '',
      'subtract': {'#is': 'subtract', '~0': '##.#input.v', '1': 5},
      '#output': {'#is': 'output', '~v': '##.subtract.output'}
    });
    Root.run();
    assert.equal(cBlock.queryProperty('$output.obj2.v').getValue(), -6, 'Map chain $src changed');
    assert.equal(cBlock.queryProperty('$output.obj3.v').getValue(), -4, 'Map chain $src changed on child Object');

    aBlock.setValue('obj2', undefined);
    let obj4 = aBlock.createBlock('obj4');
    obj4.setValue('v', '4');
    aBlock.updateValue('obj5', {'v': 5});
    Root.run();

    assert.isUndefined(cBlock.queryProperty('$output.obj2').getValue(), 'remove object');
    assert.equal(cBlock.queryProperty('$output.obj4.v').getValue(), -2, 'add watch child');
    assert.equal(cBlock.queryProperty('$output.obj5.v').getValue(), 0, 'add watch child Object');
  });

  it('watch object', () => {
    let job = new Job();

    let bBlock = job.createBlock('b');

    job.updateValue('a', {'obj1': {'v': 1}, 'obj2': {'v': 2}});
    bBlock._load({
      '#is': 'map',
      '~$input': '##.a',
      '$src': {
        '#is': {
          '#is': '',
          'add': {'#is': 'add', '~0': '##.#input.v', '1': 1},
          '#output': {'#is': 'output', '~v': '##.add.output'}
        }
      }
    });

    Root.run();
    assert.equal(bBlock.queryProperty('$output.obj1.v').getValue(), 2, 'basic Map on Object');

    job.updateValue('a', {'obj3': {'v': 3}, 'obj2': {'v': 2}});
    Root.run();
    assert.isUndefined(bBlock.queryProperty('$output.obj1').getValue(), 'update input');
    assert.equal(bBlock.queryProperty('$output.obj2.v').getValue(), 3, 'update input');
    assert.equal(bBlock.queryProperty('$output.obj3.v').getValue(), 4, 'update input');
  });
});
