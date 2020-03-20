import {assert} from 'chai';
import {Job} from '../Job';
import {JobHistory} from '../JobHistory';
import {shouldHappen} from '../../util/test-util';

describe('JobHistory', function() {
  it('undo redo', function() {
    let job = new Job();
    job.setValue('a', 1);
    job.startHistory();
    let history = job._history;

    history.undo();
    assert.isUndefined(job.getValue('@has-undo'));
    assert.isUndefined(job.getValue('@has-redo'));

    job.setValue('a', 2);
    history.add(job.save());

    assert.equal(job.getValue('@has-undo'), true);
    assert.isUndefined(job.getValue('@has-redo'));

    history.undo();
    assert.equal(job.getValue('a'), 1);

    assert.isUndefined(job.getValue('@has-undo'));
    assert.equal(job.getValue('@has-redo'), true);

    job.setValue('a', 3);
    history.add(job.save());

    assert.equal(job.getValue('@has-undo'), true);
    assert.isUndefined(job.getValue('@has-redo'));

    history.undo();
    history.redo();
    assert.equal(job.getValue('a'), 3);

    job.destroyHistory();
    assert.isUndefined(job.getValue('@has-undo'));
    assert.isUndefined(job.getValue('@has-redo'));
    assert.isNull(job._history);

    job.destroy();
  });

  it('trackChange', async function() {
    let job = new Job();
    job.load({a: 1}, null, (data) => true);
    job.startHistory();
    let history = job._history;
    job.setValue('a', 2);

    job.trackChange();
    assert.isTrue(history._tracking);
    assert.isTrue(job.getValue('@has-change'));

    job.undo();
    assert.isFalse(history._tracking);
    assert.equal(job.getValue('a'), 1);
    assert.isUndefined(job.getValue('@has-change'));

    job.setValue('a', 3);
    job.trackChange();
    job.redo(); // shouldn't do anything
    assert.isTrue(history._tracking);

    job.setValue('a', 4);
    job.trackChange();

    await shouldHappen(() => history._tracking === false, 1500);

    job.applyChange();
    assert.isUndefined(job.getValue('@has-change'));

    job.undo();
    assert.equal(job.getValue('a'), 1);
    assert.isTrue(job.getValue('@has-change'));

    job.destroy();
  });
});
