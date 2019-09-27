import {assert} from 'chai';
import {dummyInterface} from '../../util/test-util';
import {TrackedClientConn} from '../TrackedClientConn';

describe('TrackedClientConn', function() {
  it('changed', async function() {
    let tracked = new TrackedClientConn(dummyInterface as any);
    assert.isFalse(tracked.changed._value);

    tracked.callImmediate(null);
    assert.isFalse(tracked.changed._value);

    tracked.lockImmediate(null);
    assert.isFalse(tracked.changed._value);

    tracked.unlockImmediate(null);
    assert.isFalse(tracked.changed._value);

    tracked.cancel(null);
    assert.isFalse(tracked.changed._value);

    tracked.listChildren(null, null, null, null);
    assert.isFalse(tracked.changed._value);

    tracked.subscribe(null, null, null);
    assert.isFalse(tracked.changed._value);

    tracked.unsubscribe(null, null);
    assert.isFalse(tracked.changed._value);

    tracked.watch(null, null);
    assert.isFalse(tracked.changed._value);

    tracked.unwatch(null, null);
    assert.isFalse(tracked.changed._value);

    tracked.watchDesc(null, null);
    assert.isFalse(tracked.changed._value);

    tracked.unwatchDesc(null);
    assert.isFalse(tracked.changed._value);

    tracked.findGlobalBlocks(null);
    assert.isFalse(tracked.changed._value);

    tracked.getValue(null, null);
    assert.isFalse(tracked.changed._value);

    tracked.updateValue(null, null, null);
    assert.isFalse(tracked.changed._value);

    tracked.editWorker(null, null, null, null);
    assert.isFalse(tracked.changed._value);

    tracked.setValue(null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();
    assert.isFalse(tracked.changed._value);

    tracked.setBinding(null, null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();

    tracked.createBlock(null, null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();

    tracked.applyWorkerChange(null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();

    tracked.showProps(null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();

    tracked.hideProps(null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();

    tracked.moveShownProp(null, null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();

    tracked.setLen(null, null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();

    tracked.addMoreProp(null, null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();

    tracked.removeMoreProp(null, null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();

    tracked.moveMoreProp(null, null, null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();

    tracked.insertGroupProp(null, null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();

    tracked.removeGroupProp(null, null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();

    tracked.moveGroupProp(null, null, null, null, null);
    assert.isTrue(tracked.changed._value);
    tracked.acknowledge();
  });
});
