// a simple id system
// goes from 0 to 2gosa7pa2gu then 0-0 to 2gosa7pa2gu-2gosa7pa2gu then 0-0-0
// (Number.MAX_SAFE_INTEGER-1).toString(36) == 2gosa7pa2gu

export class Uid {
  _count = 0;
  _prefix?: Uid;

  _current: string = '0';

  get current(): string {
    return this._current;
  }

  next(): string {
    if (++this._count === Number.MAX_SAFE_INTEGER) {
      this._count = 0;
      if (!this._prefix) {
        this._prefix = new Uid();
      } else {
        this._prefix.next();
      }
    }
    if (this._prefix) {
      this._current = `${this._prefix.current}-${this._count.toString(36)}`;
    } else {
      this._current = this._count.toString(36);
    }
    return this._current;
  }
}