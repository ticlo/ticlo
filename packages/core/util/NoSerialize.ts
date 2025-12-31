// When object can't be serialized but we still want it to show it's name in the editor
export class NoSerialize {
  constructor(public title: string) {}

  toString() {
    return `${this.title}`;
  }
  toJSON() {
    return `͢:${this.title}`;
  }
}

export function decodeUnknown(str: string): any {
  return new NoSerialize(str.substring(2));
}

export function encodeUnknown(obj: object): any {
  return `͢:${obj.toString()}`;
}

export function escapedObject<T>(title: string, obj: T): T & NoSerialize {
  (obj as any).__proto__ = NoSerialize.prototype;
  (obj as any).title = title;
  return obj as any;
}
