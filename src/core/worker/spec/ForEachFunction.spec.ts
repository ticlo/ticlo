import {assert} from "chai";
import {Job, Root} from "../../block/Block";
import {TestFunctionRunner} from "../../block/spec/TestFunction";
import "../../functions/basic/Math";
import "../ForEachFunction";
import {DataMap} from "../../util/Types";

describe("ForEachFunction", function () {

  it('chain block', function () {
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
      'use': {
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
      'use': {
        '#is': {
          '#is': '',
          'multiply': {'#is': 'multiply', '~0': '##.#input.v', '1': 2},
          '#output': {'#is': 'output', '~v': '##.multiply.output'}
        }
      }
    });
    Root.run();

    assert.lengthOf(TestFunctionRunner.popLogs(), 3, 'worker run 3 times');

    assert.equal(bBlock.queryValue('output.obj1.v'), 2, 'basic ForEach chain');
    assert.equal(cBlock.queryValue('output.obj2.v'), 6, 'basic ForEach chain');
    assert.equal(cBlock.queryValue('output.obj3.v'), 8, 'basic ForEach chain on child Object');

    bBlock.updateValue('use', {
      '#is': '',
      'test': {'#is': 'test-runner', '~#-log': '##.#input.v'},
      'subtract': {'#is': 'subtract', '~0': '##.#input.v', '1': 5},
      '#output': {'#is': 'output', '~v': '##.subtract.output'}
    });
    Root.run();
    assert.lengthOf(TestFunctionRunner.popLogs(), 3, 'worker run 3 times');

    assert.equal(cBlock.queryValue('output.obj2.v'), -6, 'ForEach chain use changed');
    assert.equal(cBlock.queryValue('output.obj3.v'), -4, 'ForEach chain use changed on child Object');

    aBlock.deleteValue('obj2');
    let obj4 = aBlock.createBlock('obj4');
    obj4.setValue('v', 4);
    aBlock.updateValue('obj5', {'v': 5});

    Root.run();
    assert.lengthOf(TestFunctionRunner.popLogs(), 2, 'worker run twice on 2 change items');

    assert.isUndefined(cBlock.queryValue('output.obj2'), 'remove object');
    assert.equal(cBlock.queryValue('output.obj4.v'), -2, 'add watch child');
    assert.equal(cBlock.queryValue('output.obj5.v'), 0, 'add watch child Object');

    job.updateValue('b', null);
    aBlock.updateValue('obj6', {'v': 6});

    Root.run();

    assert.isUndefined(cBlock.queryValue('output'), 'output is removed when input is empty');

    assert.isEmpty(TestFunctionRunner.logs, 'worker should not run after destroyed');
  });

  it('watch object', function () {
    let job = new Job();

    let bBlock = job.createBlock('b');

    job.updateValue('a', {'obj1': {'v': 1}, 'obj2': {'v': 2}});
    bBlock._load({
      '#is': 'foreach',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          'add': {'#is': 'add', '~0': '##.#input.v', '1': 1},
          '#output': {'#is': 'output', '~v': '##.add.output'}
        }
      }
    });

    Root.run();
    assert.equal(bBlock.queryValue('output.obj1.v'), 2, 'basic ForEach on Object');

    job.updateValue('a', {'obj3': {'v': 3}, 'obj2': {'v': 2}});
    Root.run();
    assert.isUndefined(bBlock.queryValue('output.obj1'), 'update input');
    assert.equal(bBlock.queryValue('output.obj2.v'), 3, 'update input');
    assert.equal(bBlock.queryValue('output.obj3.v'), 4, 'update input');

    bBlock.setValue('#is', '');
    assert.isUndefined(bBlock.queryValue('output'), 'destroy ForEachFunction');
    assert.isUndefined(bBlock.queryValue('#func'), 'destroy ForEachFunction');
  });

  it('foreach primitive types', function () {
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
      'use': {
        '#is': {
          '#is': '',
          'add': {'#is': 'add', '~0': '##.#input', '1': 1},
          '~#output': 'add.output'
        }
      }
    });

    Root.run();
    assert.equal(bBlock.queryValue('output.v1'), 2);

    aBlock.setValue('v3', 3);
    aBlock.deleteValue('v1');

    Root.run();
    assert.isUndefined(bBlock.queryValue('output.v1'));
    assert.equal(bBlock.queryValue('output.v2'), 3);
    assert.equal(bBlock.queryValue('output.v3'), 4);

    job.setValue('a', 1);

    Root.run();
    assert.isUndefined(bBlock.queryValue('output'), 'clear output when input is no longer Object or Block');
  });

  it('clear foreach use', function () {
    let job = new Job();

    let aBlock = job.createBlock('a');
    let bBlock = job.createBlock('b');
    aBlock._load({'v1': 1});
    bBlock._load({
      '#is': 'foreach',
      '~input': '##.a',
      'use': {
        '#is': {
          '#is': '',
          '~#output': '#input'
        }
      }
    });

    Root.run();
    assert.equal(bBlock.queryValue('output.v1'), 1);

    bBlock.setValue('use', null);
    Root.run();
    assert.isUndefined(bBlock.queryValue('output'), 'clear output when use is invalid');
  });
});
