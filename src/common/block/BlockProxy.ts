import {Block} from "./Block";


export const BlockProxy = {
  get(block: Block, field: string, receiver: object): any {
    let prop = block._props[field];
    if (prop) {
      return prop._value;
    }
    return undefined;
  },

  set(block: Block, field: string, value: any, receiver: object): boolean {
    let prop = block.getProperty(field);
    prop.updateValue(value);
    return true;
  },

  ownKeys(block: Block): string[] {
    if (block._destroyed) {
      return [];
    }
    let result: string[] = [];
    if (!block._ioProps) {
      block._initIoCache();
    }
    for (let field in this._ioProps) {
      let prop = this._ioProps[field];
      if (prop._value !== undefined) {
        result.push(field);
      }
    }
    return result;
  }
};

export const BlockDeepProxy = {
  ...BlockProxy,

  get(block: Block, field: string, receiver: object): any {
    let prop = block._props[field];
    if (prop) {
      let val = prop._value;
      if (val instanceof Block) {
        return prop._value.getProxy();
      }
      return val;
    }
    return undefined;
  },
};
