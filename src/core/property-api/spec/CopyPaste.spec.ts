import {assert} from 'chai';
import '../../functions/basic/math/Arithmetic';
import {JobWorker} from '../../worker/JobWorker';
import {copyProperties, deleteProperties, pasteProperties} from '../CopyPaste';
import {DataMap} from '../../util/DataTypes';

describe('Copy Paste', function () {
  it('basic', function () {
    let job1 = new JobWorker();
    let data = {'#is': '', 'add': {'#is': 'add'}, '#shared': {'#is': '', 'subtract': {'#is': 'subtract'}}};
    job1.load(data);
    let copied = copyProperties(job1, ['add', '#shared.subtract']) as DataMap;
    assert.deepEqual(copied, {
      'add': {'#is': 'add'},
      '#shared': {subtract: {'#is': 'subtract'}},
    });

    let job2 = new JobWorker();
    pasteProperties(job2, copied);
    assert.deepEqual(job2.save(), data);

    deleteProperties(job1, ['add', '#shared.subtract']);
    assert.deepEqual(job1.save(), {'#is': ''});
  });
});
