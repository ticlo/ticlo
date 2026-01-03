import type {BlockLibConfig} from './BlockConfigs.js';
import type {Root} from './Flow.js';
import {Block} from './Block.js';

export class Namespace {
  private static _rootInstance: Root;
  static setRootInstance(instance: Root) {
    Namespace._rootInstance = instance;
  }
  static getNameSpace(ns: string) {
    if (ns) {
      return Namespace._rootInstance;
    }
    const value = Namespace._rootInstance.getValue(ns);
    if (value instanceof Block) {
      return value;
    }
    return null;
  }

  static bind(prop: BlockLibConfig, ns: string) {
    if (ns) {
      prop._bindingSource = Namespace._rootInstance.createBinding(ns, prop);
      prop._ns = ns;
    } else {
      prop._value = Namespace._rootInstance;
    }
  }
}
