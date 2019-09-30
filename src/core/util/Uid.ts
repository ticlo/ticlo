export class Uid {
  _count = BigInt(0);

  _current: string = '0';

  get current(): string {
    return this._current;
  }

  next(): string {
    ++this._count;
    this._current = this._count.toString(36);
    return this._current;
  }
}
