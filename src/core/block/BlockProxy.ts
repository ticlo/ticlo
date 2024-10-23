import {Block} from './Block';

const defaultPropertyDescriptor = {
  writable: true,
  enumerable: true,
  configurable: true,
};

function blockToString() {
  return '[Block]';
}
function blockvalueOf() {
  return NaN;
}
function getDefaultFunctions(block: Block, field: string) {
  if (field === 'toString') {
    return blockToString;
  } else if (field === 'valueOf') {
    return blockvalueOf;
  }
  return undefined;
}

export const BlockProxy = {
  get(block: Block, field: string, receiver: object): unknown {
    if (typeof field === 'string') {
      let defaultFunction = getDefaultFunctions(block, field);
      if (defaultFunction) {
        return defaultFunction;
      }
      let prop = block.getProperty(field, false);
      if (prop) {
        return prop._value;
      }
    }
    return undefined;
  },

  set(block: Block, field: string, value: unknown, receiver: object): boolean {
    if (typeof field === 'string') {
      let prop = block.getProperty(field);
      prop.updateValue(value);
      return true;
    }
    return false;
  },

  ownKeys(block: Block): string[] {
    if (block._destroyed) {
      return [];
    }
    let result: string[] = [];
    if (!block._ioCache) {
      block._initIoCache();
    }
    for (let [field, prop] of block._ioCache) {
      if (prop._value !== undefined) {
        result.push(field);
      }
    }
    return result;
  },
  isExtensible(block: Block) {
    return true;
  },
  has(block: Block, field: string): boolean {
    if (typeof field === 'string') {
      let prop = block.getProperty(field, false);
      return prop && prop._value !== undefined;
    }
    return false;
  },
  getOwnPropertyDescriptor(block: Block, field: string): PropertyDescriptor | undefined {
    return defaultPropertyDescriptor;
  },
};

export const BlockDeepProxy = {
  ...BlockProxy,

  get(block: Block, field: string, receiver: object): unknown {
    if (typeof field === 'string') {
      let defaultFunction = getDefaultFunctions(block, field);
      if (defaultFunction) {
        return defaultFunction;
      }
      let prop = block.getProperty(field, false);
      if (prop) {
        let val = prop._value;
        if (val instanceof Block) {
          return new Proxy(prop._value, BlockDeepProxy);
        }
        return val;
      }
    }
    return undefined;
  },
};
