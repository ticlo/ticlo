import {expect} from 'vitest';
import {InfiniteQueue} from '../InfiniteQueue.js';

describe('InfiniteQueue', function () {
  it('basic', function () {
    let q = new InfiniteQueue();

    q.push(1);
    expect(q.total).toBe(1);
    q.push(2);
    expect(q.total).toBe(2);
    expect(q.newSlot()).toBe(2);

    q.shift();
    expect(q.from).toBe(1);
    expect(q.total).toBe(3);
    expect(q.at(1)).toBe(2);
    q.setAt(2, 3);
    expect(q.at(2)).toBe(3);

    q.clear();
    expect(q.from).toBe(0);
    expect(q.total).toBe(0);

    // invalid shift should not change from
    q.shift();
    expect(q.from).toBe(0);

    expect(() => q.setAt(0.1, 0)).toThrow();
    expect(() => q.setAt(2, 0)).toThrow();
    expect(() => q.setAt(-2, 0)).toThrow();
  });
});
