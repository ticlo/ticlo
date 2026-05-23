// When object can't be serialized but we still want it to show it's name in the editor
export class NoSerialize {
  type: string;
  value: string;
  constructor(public title: string) {
    const colonIndex = title.indexOf(':');
    if (colonIndex > 0) {
      this.type = title.substring(0, colonIndex);
      this.value = title.substring(colonIndex + 1);
    }
  }

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
