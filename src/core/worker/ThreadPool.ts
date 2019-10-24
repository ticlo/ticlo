export class ThreadPool {
  _size: number;
  // contains all the available numbers
  _ready = new Set<number | string>();
  // contain numbers that's not fully destroyed, reuse these first
  _pending = new Set<number | string>();

  // numbers not initialized are not in _ready set, but still assumed ready
  _inited = 0;

  _destroyCallback: (n: number | string) => void;
  _readyCallback: () => void;

  constructor(size: number, destroyCallback: (n: number | string) => void, readyCallback: () => void) {
    this._size = size;
    this._destroyCallback = destroyCallback;
    this._readyCallback = readyCallback;
  }

  resize(size: number) {
    if (size === this._size) {
      return false;
    }
    if (size < this._size) {
      if (this._inited > size) {
        this._inited = size;
      }
    } else {
      if (this._ready.size === 0 && this._pending.size === 0 && this._inited === this._size) {
        // new thread available after the size change
        this._size = size;
        this._readyCallback();
        return true;
      }
    }
    this._size = size;
    return false;
  }

  next(key: string): string {
    for (;;) {
      let result = Infinity;
      if (this._pending.size) {
        result = this._pending.values().next().value;
        this._pending.delete(result);
      } else if (this._ready.size) {
        result = this._ready.values().next().value;
        this._ready.delete(result);
      } else if (this._inited < this._size) {
        result = this._inited;
        this._inited++;
      } else {
        return null;
      }
      if (result < this._size) {
        return result.toString();
      } else {
        // bigger than the pool allowed
        this._destroyCallback(result);
      }
    }
  }

  done(n: number | string, pending: boolean) {
    if (n < this._size) {
      if (pending) {
        this._pending.add(n);
      } else {
        this._destroyCallback(n);
        this._ready.add(n);
      }
      this._readyCallback();
    } else {
      this._destroyCallback(n);
    }
  }

  clearPending() {
    for (let n of this._pending) {
      this._destroyCallback(n);
      this._ready.add(n);
    }
    this._pending.clear();
  }

  clear() {
    this._inited = 0;
    this._ready.clear();
    this._pending.clear();
  }
}

export class UnlimitedPool {
  // contain numbers that's not fully destroyed, reuse these first
  _pending = new Set<number | string>();

  _destroyCallback: (n: number | string) => void;
  _readyCallback: () => void;

  _inited = 0;

  constructor(destroyCallback: (n: number | string) => void, readyCallback: () => void) {
    this._destroyCallback = destroyCallback;
    this._readyCallback = readyCallback;
  }
  next(preferred: string): string {
    if (preferred == null) {
      // no preferred value, automatically assign one
      if (this._pending.size) {
        let value = this._pending.values().next().value;
        this._pending.delete(value);
        return value;
      }
      return `${this._inited++}`;
    } else if (this._pending.has(preferred)) {
      this._pending.delete(preferred);
    }
    return preferred;
  }
  clearPending() {
    for (let n of this._pending) {
      this._destroyCallback(n);
    }
    this._pending.clear();
  }
  done(n: number | string, pending: boolean) {
    if (pending) {
      this._pending.add(n);
    } else {
      this._destroyCallback(n);
    }
    this._readyCallback();
  }
  clear() {
    this._inited = 0;
    this._pending.clear();
  }
}

export type WorkerPool = ThreadPool | UnlimitedPool;
