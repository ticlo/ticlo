export class EscapedObject {
  constructor(public title: string) {}

  toString() {
    return `${this.title}`;
  }
  toJSON() {
    return `͢:${this.title}`;
  }
}

export function decodeUnknown(str: string): any {
  return new EscapedObject(str.substring(2));
}

export function encodeUnknown(obj: object): any {
  return `͢:${obj.toString()}`;
}

export function escapedObject<T>(title: string, obj: T): T & EscapedObject {
  (obj as any).__proto__ = EscapedObject.prototype;
  (obj as any).title = title;
  return obj as any;
}
