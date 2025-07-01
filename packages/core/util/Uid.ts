export class Uid {
  _count = BigInt(0);

  _current: string = '0';

  get current(): string {
    return this._current;
  }

  next(radix = 36): string {
    ++this._count;
    this._current = this._count.toString(radix);
    return this._current;
  }
}
