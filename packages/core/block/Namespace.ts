import type {Root} from './Flow.js';
import {Block} from './Block.js';

export class Namespace {
  private static _rootInstance: Root;
  static setRootInstance(instance: Root) {
    Namespace._rootInstance = instance;
  }

  static getProp(ns: string) {
    return Namespace._rootInstance?.getProperty(ns);
  }
  static getNsRoot(ns: string) {
    if (!ns) {
      return Namespace._rootInstance;
    }
    const value = Namespace._rootInstance.getValue(ns);
    if (value instanceof Block) {
      return value;
    }
    return null;
  }
}
