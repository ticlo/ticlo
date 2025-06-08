import type {BlockLibConfig} from './BlockConfigs';
import type {Root} from './Flow';
import {Block} from './Block';

export class Namespace {
  static #rootInstance: Root;
  static setRootInstance(instance: Root) {
    Namespace.#rootInstance = instance;
  }
  static getNameSpace(ns: string) {
    if (ns) {
      return Namespace.#rootInstance;
    }
    const value = Namespace.#rootInstance.getValue(ns);
    if (value instanceof Block) {
      return value;
    }
    return null;
  }

  static bind(prop: BlockLibConfig, ns: string) {
    if (ns) {
      prop._bindingSource = Namespace.#rootInstance.createBinding(ns, prop);
      prop._ns = ns;
    } else {
      prop._value = Namespace.#rootInstance;
    }
  }
}
