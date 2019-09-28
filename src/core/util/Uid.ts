// a simple id system
// goes from 0 to 2gosa7pa2gu then 0-0 to 2gosa7pa2gu-2gosa7pa2gu then 0-0-0
// (Number.MAX_SAFE_INTEGER-1).toString(36) == 2gosa7pa2gu

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
