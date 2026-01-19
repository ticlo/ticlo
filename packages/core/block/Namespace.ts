import type {Flow, Root} from './Flow.js';
import {Block} from './Block.js';
import {FunctionDispatcher, Functions, globalFunctions} from './Functions.js';
import {FunctionClass} from './BlockFunction.js';
import {PropListener} from './Dispatcher.js';
import {DataMap} from '../editor.js';
import {NsFunctionGroup} from './FunctionGroup.js';

export class Namespace {
  private static _rootInstance: Root;
  static setRootInstance(instance: Root) {
    // need this function to avoid circular dependency
    Namespace._rootInstance = instance;
  }

  // return property for binding
  static bind(ns: string) {
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

  static _dict: Record<string, Namespace> = {};

  static getFunctionGroup(id: string) {
    const parts = id.split(':');
    if (parts.length > 1) {
      const ns = parts[0];
      if (ns.length > 1) {
        // single character namespace is not allowed
        let namespace = Namespace._dict[ns];
        if (namespace == null) {
          namespace = new Namespace(ns);
          Namespace._dict[ns] = namespace;
        }
        return namespace.getGroup(parts[1]);
      }
    }
    return undefined;
  }

  static listen(id: string, block: PropListener<FunctionClass>): FunctionDispatcher {
    const parts = id.split(':');
    const ns = parts[0];
    let namespace = Namespace._dict[ns];
    if (namespace == null) {
      namespace = new Namespace(ns);
      Namespace._dict[ns] = namespace;
    }
    if (ns.length > 2) {
      // the default group (parts[1]) can be empty string
      return namespace.listen(parts[1], id, block);
    }
    return null;
  }

  static getFunctions(funcId: string, flow: Flow): Functions {
    const code0 = funcId.charCodeAt(0);
    if (code0 === 58 /* : */) {
      // local function
      return flow.getFuncGroup();
    } else if (code0 === 43 /* + */) {
      // namespace function
      if (funcId.charCodeAt(1) === 58 /* +: */) {
        // replace + with current namespace
        return Namespace.getFunctionGroup(flow._namespace + funcId.substring(1));
      } else {
        return Namespace.getFunctionGroup(funcId);
      }
    } else if (code0 > 0) {
      // global function
      return globalFunctions;
    }
    return null;
  }

  static loadNs(ns: string) {}

  _groups: Record<string, NsFunctionGroup> = {};

  constructor(public readonly ns: string) {}
  _loaded: boolean | 'loading' = false;
  load() {
    if (this._loaded === false) {
      this._loaded = 'loading';
    }
  }
  getGroup(group: string) {
    let g = this._groups[group];
    if (!g) {
      g = new NsFunctionGroup(this.ns, group);
      this._groups[group] = g;
      if (this._loaded === false) {
        g.loadFromStorage();
      }
    }
    return g;
  }
  listen(group: string, id: string, block: PropListener<FunctionClass>): FunctionDispatcher {
    return this.getGroup(group).listen(id, block);
  }
}
