import {assert} from "chai";
import {Job, Root} from "../../block/Job";
import {Block} from "../../block/Block";
import {TestFunctionRunner} from "../../block/spec/TestFunction";
import "../../functions/basic/Math";
import "../ForEachFunction";
import {DataMap} from "../../util/Types";

describe("ForEachFunction", () => {

  it('chain block', () => {
    TestFunctionRunner.clearLog();
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
      '#is': 'foreach',
      '~input': '##.a',
      'src': {
        '#is': {
          '#is': '',
          'test': {'#is': 'test-runner', '~#-log': '##.#input.v'},
          'add': {'#is': 'add', '~0': '##.#input.v', '1': 1},
          '#output': {'#is': 'output', '~v': '##.add.output'}
        }
      }
    });
    cBlock._load({
      '#is': 'foreach',
      '~input': '##.b.output',
      'src': {
        '#is': {
          '#is': '',
          'multiply': {'#is': 'multiply', '~0': '##.#input.v', '1': 2},
          '#output': {'#is': 'output', '~v': '##.multiply.output'}
        }
      }
    });
    Root.run();

    assert.lengthOf(TestFunctionRunner.popLogs(), 3, 'worker run 3 times');

    assert.equal(bBlock.queryProperty('output.obj1.v').getValue(), 2, 'basic ForEach chain');
    assert.equal(cBlock.queryProperty('output.obj2.v').getValue(), 6, 'basic ForEach chain');
    assert.equal(cBlock.queryProperty('output.obj3.v').getValue(), 8, 'basic ForEach chain on child Object');

    bBlock.updateValue('src', {
      '#is': '',
      'test': {'#is': 'test-runner', '~#-log': '##.#input.v'},
      'subtract': {'#is': 'subtract', '~0': '##.#input.v', '1': 5},
      '#output': {'#is': 'output', '~v': '##.subtract.output'}
    });
    Root.run();
    assert.lengthOf(TestFunctionRunner.popLogs(), 3, 'worker run 3 times');

    assert.equal(cBlock.queryProperty('output.obj2.v').getValue(), -6, 'ForEach chain src changed');
    assert.equal(cBlock.queryProperty('output.obj3.v').getValue(), -4, 'ForEach chain src changed on child Object');

    aBlock.deleteValue('obj2');
    let obj4 = aBlock.createBlock('obj4');
    obj4.setValue('v', 4);
    aBlock.updateValue('obj5', {'v': 5});

    Root.run();
    assert.lengthOf(TestFunctionRunner.popLogs(), 2, 'worker run twice on 2 change items');

    assert.isUndefined(cBlock.queryProperty('output.obj2').getValue(), 'remove object');
    assert.equal(cBlock.queryProperty('output.obj4.v').getValue(), -2, 'add watch child');
    assert.equal(cBlock.queryProperty('output.obj5.v').getValue(), 0, 'add watch child Object');

    job.updateValue('b', null);
    aBlock.updateValue('obj6', {'v': 6});

    Root.run();

    assert.isUndefined(cBlock.queryProperty('output').getValue(), 'output is removed when input is empty');

    assert.isEmpty(TestFunctionRunner.logs, 'worker should not run after destroyed');
  });

  it('watch object', () => {
    let job = new Job();

    let bBlock = job.createBlock('b');

    job.updateValue('a', {'obj1': {'v': 1}, 'obj2': {'v': 2}});
    bBlock._load({
      '#is': 'foreach',
      '~input': '##.a',
      'src': {
        '#is': {
          '#is': '',
          'add': {'#is': 'add', '~0': '##.#input.v', '1': 1},
          '#output': {'#is': 'output', '~v': '##.add.output'}
        }
      }
    });

    Root.run();
    assert.equal(bBlock.queryProperty('output.obj1.v').getValue(), 2, 'basic ForEach on Object');

    job.updateValue('a', {'obj3': {'v': 3}, 'obj2': {'v': 2}});
    Root.run();
    assert.isUndefined(bBlock.queryProperty('output.obj1').getValue(), 'update input');
    assert.equal(bBlock.queryProperty('output.obj2.v').getValue(), 3, 'update input');
    assert.equal(bBlock.queryProperty('output.obj3.v').getValue(), 4, 'update input');

    bBlock.setValue('#is', '');
    assert.isUndefined(bBlock.queryProperty('output').getValue(), 'destroy ForEachFunction');
    assert.isUndefined(bBlock.queryProperty('#func').getValue(), 'destroy ForEachFunction');
  });

  it('foreach primitive types', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');
    let bBlock = job.createBlock('b');
    aBlock._load({
      '#is': '',
      'v1': 1,
      'v2': "2"
    });
    bBlock._load({
      '#is': 'foreach',
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
    assert.equal(bBlock.queryProperty('output.v1').getValue(), 2);

    aBlock.setValue('v3', 3);
    aBlock.deleteValue('v1');

    Root.run();
    assert.isUndefined(bBlock.queryProperty('output.v1').getValue());
    assert.equal(bBlock.queryProperty('output.v2').getValue(), 3);
    assert.equal(bBlock.queryProperty('output.v3').getValue(), 4);

    job.setValue('a', 1);

    Root.run();
    assert.isUndefined(bBlock.queryProperty('output').getValue(), 'clear output when input is no longer Object or Block');
  });

  it('clear foreach src', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');
    let bBlock = job.createBlock('b');
    aBlock._load({'v1': 1});
    bBlock._load({
      '#is': 'foreach',
      '~input': '##.a',
      'src': {
        '#is': {
          '#is': '',
          '~#output': '#input'
        }
      }
    });

    Root.run();
    assert.equal(bBlock.queryProperty('output.v1').getValue(), 1);

    bBlock.setValue('src', null);
    Root.run();
    assert.isUndefined(bBlock.queryProperty('output').getValue(), 'clear output when src is invalid');
  });
});
