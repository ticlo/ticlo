import expect from 'expect';
import {InfiniteQueue} from '../InfiniteQueue';

describe('InfiniteQueue', function () {
  it('basic', function () {
    let q = new InfiniteQueue();

    q.push(1);
    expect(q.total).toEqual(1);
    q.push(2);
    expect(q.total).toEqual(2);
    expect(q.newSlot()).toEqual(2);

    q.shift();
    expect(q.from).toEqual(1);
    expect(q.total).toEqual(3);
    expect(q.at(1)).toEqual(2);
    q.setAt(2, 3);
    expect(q.at(2)).toEqual(3);

    q.clear();
    expect(q.from).toEqual(0);
    expect(q.total).toEqual(0);

    // invalid shift should not change from
    q.shift();
    expect(q.from).toEqual(0);

    expect(() => q.setAt(0.1, 0)).toThrow();
    expect(() => q.setAt(2, 0)).toThrow();
    expect(() => q.setAt(-2, 0)).toThrow();
  });
});
