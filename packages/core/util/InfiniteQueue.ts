import Denque from 'denque';

/**
 * A queue class that always maintain the original index when item is pushed to the list
 */
export class InfiniteQueue<T> extends Denque<T> {
  declare _list: T[];
  declare _head: number;
  declare _tail: number;
  declare _capacityMask: number;
  declare size: () => number;

  // TODO use BigInt ?
  from = 0;
  total = 0;
  push(item: T) {
    ++this.total;
    return super.push(item);
  }
  shift() {
    if (this.length) {
      ++this.from;
    }
    return super.shift();
  }

  at(i: number) {
    return this.peekAt(i - this.from);
  }

  // REFACTOR(design.md): MUST bound retained out-of-order deliveries or apply backpressure.
  setAt(i: number, item: T) {
    i -= this.from;
    if (i !== (i | 0)) {
      throw new Error('invalid index');
    }
    const len = this.size();
    if (i >= len || i < 0) {
      throw new Error('invalid index');
    }
    i = (this._head + i) & this._capacityMask;
    this._list[i] = item;
  }

  // REFACTOR(design.md): MUST reserve slots only within the scheduler's bounded delivery policy.
  newSlot() {
    // Denque doesn't allow push(undefined), use the following trick as work around
    const tail = this._tail;
    super.push(null);
    this._list[tail] = undefined;
    return this.total++;
  }

  clear(): void {
    super.clear();
    this.from = 0;
    this.total = 0;
  }
}
