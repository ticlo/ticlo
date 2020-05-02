import {assert} from 'chai';
import {Flow} from '../Flow';
import {FlowHistory} from '../FlowHistory';
import {shouldHappen} from '../../util/test-util';
import {WorkerFlow} from '../../worker/WorkerFlow';

describe('FlowHistory', function () {
  it('undo redo', function () {
    let flow = new Flow();
    flow.setValue('a', 1);
    flow.startHistory();
    let history = flow._history;

    history.undo();
    assert.isUndefined(flow.getValue('@has-undo'));
    assert.isUndefined(flow.getValue('@has-redo'));

    flow.setValue('a', 2);
    history.add(flow.save());

    assert.equal(flow.getValue('@has-undo'), true);
    assert.isUndefined(flow.getValue('@has-redo'));

    history.undo();
    assert.equal(flow.getValue('a'), 1);

    assert.isUndefined(flow.getValue('@has-undo'));
    assert.equal(flow.getValue('@has-redo'), true);

    flow.setValue('a', 3);
    history.add(flow.save());

    assert.equal(flow.getValue('@has-undo'), true);
    assert.isUndefined(flow.getValue('@has-redo'));

    history.undo();
    history.redo();
    assert.equal(flow.getValue('a'), 3);

    flow.destroyHistory();
    assert.isUndefined(flow.getValue('@has-undo'));
    assert.isUndefined(flow.getValue('@has-redo'));
    assert.isNull(flow._history);

    flow.destroy();
  });

  it('trackChange', async function () {
    let debounceInterval = FlowHistory._debounceInterval;
    FlowHistory._debounceInterval = 50;

    let flow = new WorkerFlow();
    flow.load({a: 1}, null, (data) => true);
    flow.startHistory();
    let history = flow._history;
    flow.setValue('a', 2);

    flow.trackChange();
    assert.isTrue(history._tracking);
    assert.isTrue(flow.getValue('@has-change'));

    flow.undo();
    assert.isFalse(history._tracking);
    assert.equal(flow.getValue('a'), 1);
    assert.isUndefined(flow.getValue('@has-change'));

    flow.setValue('a', 3);
    flow.trackChange();
    flow.redo(); // shouldn't do anything
    assert.isTrue(history._tracking);

    flow.setValue('a', 4);
    flow.trackChange();

    await shouldHappen(() => history._tracking === false);

    flow.applyChange();
    assert.isUndefined(flow.getValue('@has-change'));

    flow.undo();
    assert.equal(flow.getValue('a'), 1);
    assert.isTrue(flow.getValue('@has-change'));

    flow.setValue('a', 3);

    // destroy history
    flow.unwatch({onChildChange: () => {}});
    // reload from saved state
    assert.equal(flow.getValue('a'), 1);

    flow.destroy();
    FlowHistory._debounceInterval = debounceInterval;
  });
});
