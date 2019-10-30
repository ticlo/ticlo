import {assert} from 'chai';
import {InfiniteQueue} from '../InfiniteQueue';

describe('InfiniteQueue', function() {
  it('basic', function() {
    let q = new InfiniteQueue();

    q.push(1);
    assert.equal(q.total, 1);
    q.push(2);
    assert.equal(q.total, 2);
    assert.equal(q.newSlot(), 2);

    q.shift();
    assert.equal(q.from, 1);
    assert.equal(q.total, 3);
    assert.equal(q.at(1), 2);
    q.setAt(2, 3);
    assert.equal(q.at(2), 3);

    q.clear();
    assert.equal(q.from, 0);
    assert.equal(q.total, 0);

    assert.throw(() => q.setAt(0.1, 0));
    assert.throw(() => q.setAt(2, 0));
    assert.throw(() => q.setAt(-2, 0));
  });
});
