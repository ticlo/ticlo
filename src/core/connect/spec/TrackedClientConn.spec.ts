import {assert} from 'chai';
import {dummyInterface} from '../../util/test-util';
import {TrackedClientConn} from '../TrackedClientConn';

describe('TrackedClientConn', function() {
  it('changed', async function() {
    let tracked = new TrackedClientConn(dummyInterface as any);
    assert.isFalse(tracked.isChanged());

    tracked.callImmediate(null);
    assert.isFalse(tracked.isChanged());

    tracked.lockImmediate(null);
    assert.isFalse(tracked.isChanged());

    tracked.unlockImmediate(null);
    assert.isFalse(tracked.isChanged());

    tracked.cancel(null);
    assert.isFalse(tracked.isChanged());

    tracked.listChildren(null, null, null, null);
    assert.isFalse(tracked.isChanged());

    tracked.subscribe(null, null, null);
    assert.isFalse(tracked.isChanged());

    tracked.unsubscribe(null, null);
    assert.isFalse(tracked.isChanged());

    tracked.watch(null, null);
    assert.isFalse(tracked.isChanged());

    tracked.unwatch(null, null);
    assert.isFalse(tracked.isChanged());

    tracked.watchDesc(null, null);
    assert.isFalse(tracked.isChanged());

    tracked.unwatchDesc(null);
    assert.isFalse(tracked.isChanged());

    tracked.findGlobalBlocks(null);
    assert.isFalse(tracked.isChanged());

    tracked.getValue(null, null);
    assert.isFalse(tracked.isChanged());

    tracked.updateValue(null, null, null);
    assert.isFalse(tracked.isChanged());

    tracked.editWorker(null, null, null, null);
    assert.isFalse(tracked.isChanged());

    tracked.setValue(null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();
    assert.isFalse(tracked.isChanged());

    tracked.setBinding(null, null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();

    tracked.createBlock(null, null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();

    tracked.applyWorkerChange(null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();

    tracked.showProps(null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();

    tracked.hideProps(null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();

    tracked.moveShownProp(null, null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();

    tracked.setLen(null, null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();

    tracked.addMoreProp(null, null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();

    tracked.removeMoreProp(null, null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();

    tracked.moveMoreProp(null, null, null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();

    tracked.insertGroupProp(null, null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();

    tracked.removeGroupProp(null, null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();

    tracked.moveGroupProp(null, null, null, null, null);
    assert.isTrue(tracked.isChanged());
    tracked.acknowledge();
  });
});
