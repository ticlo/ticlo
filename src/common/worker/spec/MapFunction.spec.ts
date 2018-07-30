import {assert} from "chai";
import {Job, Root} from "../../block/Job";
import {Block} from "../../block/Block";
import {TestFunctionRunner} from "../../block/spec/TestFunction";
import "../../functions/basic/Math";
import "../MapFunction";
import {DataMap} from "../../util/Types";

describe("MapFunction", () => {

  it('basic', () => {
    TestFunctionRunner.clearLog();
    let job = new Job();

    job.setValue('a', {
      'v1': 1,
      'v2': 2,
      'v3': 3
    });

    let bBlock = job.createBlock('b');

    bBlock._load({
      '#is': 'map',
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

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 3, 'v3': 4});

    job.setValue('a', {
      'v1': 1,
      'v2': 4,
      'v4': 5
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 5, 'v4': 6});

  });

  it('reuse worker', () => {
    TestFunctionRunner.clearLog();
    let job = new Job();

    job.setValue('a', {
      'v1': 1,
      'v2': 2,
      'v3': 3
    });

    let bBlock = job.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'reuse',
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

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 3, 'v3': 4});

    job.setValue('a', {
      'v1': 1,
      'v2': 4,
      'v4': 5
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 5, 'v4': 6});
    assert.isUndefined(bBlock.queryValue('#func.v3.#output'), 'unused worker should be removed');
  });

  it('persist worker', () => {
    TestFunctionRunner.clearLog();
    let job = new Job();

    job.setValue('a', {
      'v1': 1,
      'v2': 2,
      'v3': 3
    });

    let bBlock = job.createBlock('b');

    bBlock._load({
      '#is': 'map',
      'reuseWorker': 'persist',
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

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 3, 'v3': 4});

    job.setValue('a', {
      'v1': 1,
      'v2': 4,
      'v4': 5
    });

    Root.run();

    assert.deepEqual(bBlock.getValue('output'), {'v1': 2, 'v2': 5, 'v4': 6});
    assert.equal(bBlock.queryValue('#func.v3.#output'), 4, 'unused worker is still kept');
  });

});
