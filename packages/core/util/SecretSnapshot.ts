/** A secret captured for local undo before a persistence key is available. */
export class SecretSnapshot {
  #read: (data: Uint8Array) => string;

  constructor(
    read: (data: Uint8Array) => string,
    readonly bytes: Uint8Array
  ) {
    this.#read = read;
  }

  decode() {
    return this.#read(this.bytes);
  }

  toJSON(): never {
    throw new Error('A secret snapshot cannot be serialized.');
  }
}
