import {assert} from 'chai';
import '../../functions/basic/math/Arithmetic';
import {JobWorker} from '../../worker/JobWorker';
import {copyProperties, deleteProperties, pasteProperties} from '../CopyPaste';
import {DataMap} from '../../util/DataTypes';

describe('Copy Paste', function () {
  const data = {'#is': '', 'add': {'#is': 'add', '0': 2}, '#shared': {'#is': '', 'subtract': {'#is': 'subtract'}}};
  const copy = {
    'add': {'#is': 'add', '0': 2},
    '#shared': {subtract: {'#is': 'subtract'}},
  };

  it('basic', function () {
    let job1 = new JobWorker();

    job1.load(data);
    let copied = copyProperties(job1, ['add', '#shared.subtract']) as DataMap;
    assert.deepEqual(copied, copy);

    let job2 = new JobWorker();
    pasteProperties(job2, copied);
    assert.deepEqual(job2.save(), data);

    deleteProperties(job1, ['add', '#shared.subtract']);
    assert.deepEqual(job1.save(), {'#is': ''});

    job1.destroy();
    job2.destroy();
  });

  it('rename', function () {
    let job1 = new JobWorker();
    job1.load(data);

    job1.createBlock('divide')._load({'#is': 'divide', '~0': '##.add.0'});

    let copied = copyProperties(job1, ['add', 'divide', '#shared.subtract']) as DataMap;

    pasteProperties(job1, copied, 'rename');

    assert.deepEqual(job1.save(), {
      '#is': '',
      '#shared': {
        '#is': '',
        'subtract': {'#is': 'subtract'},
        'subtract0': {'#is': 'subtract'},
      },
      'add': {'0': 2, '#is': 'add'},
      'divide': {'#is': 'divide', '~0': '##.add.0'},
      'add0': {'0': 2, '#is': 'add'},
      'divide0': {'#is': 'divide', '~0': '##.add0.0'},
    });

    job1.destroy();
  });

  it('invalid copy paste', function () {
    let job1 = new JobWorker();
    assert.equal(copyProperties(job1, ['add', '#shared.subtract']), 'nothing to copy');
    assert.equal(pasteProperties(job1, null), 'invalid data');
    assert.equal(pasteProperties(job1, []), 'invalid data');
    assert.equal(pasteProperties(job1, 1 as any), 'invalid data');

    job1.load(data);
    assert.isTrue(pasteProperties(job1, copy).startsWith('block already exists: '));

    assert.equal(pasteProperties(job1.getValue('add'), copy), '#shared properties not allowed in this Block');
  });
});
