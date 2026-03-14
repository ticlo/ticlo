import type {Flow, Root} from './Flow.js';
import {Block} from './Block.js';
import {FunctionDispatcher, FunctionGroup, globalFunctions, type DescListener} from './FunctionGroup.js';
import {FunctionClass} from './BlockFunction.js';
import {PropListener} from './Dispatcher.js';
import {FunctionDesc} from './Descriptor.js';
import {DataMap} from '../util/DataTypes.js';
import {PersistentFunctionGroup, NsFunctionGroup} from './NSFunctionGroup.js';
import type {FlowStorage} from './Storage.js';

export class Namespace {
  private static _rootInstance: Root;
  private static _storage: FlowStorage;
  static setRootInstance(instance: Root) {
    // need this function to avoid circular dependency
    Namespace._rootInstance = instance;
  }
  static setStorage(storage: FlowStorage) {
    Namespace._storage = storage;
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

  static getNameSpace(ns: string) {
    // single character namespace is not allowed
    if (ns.length > 1) {
      let namespace = Namespace._dict[ns];
      if (namespace == null) {
        namespace = new Namespace(ns);
        Namespace._dict[ns] = namespace;
      }
      return namespace;
    }
    return undefined;
  }
  static getFunctionGroup(id: string) {
    const parts = id.split(':');
    if (parts.length > 1) {
      const namespace = Namespace.getNameSpace(parts[0]);
      if (namespace) {
        return namespace.getGroup(parts[1]);
      }
    }
    return undefined;
  }

  // --- Static aggregation methods covering globalFunctions + all NsFunctionGroups ---

  static _descListeners: Set<DescListener> = new Set<DescListener>();

  /**
   * Iterate over all NsFunctionGroup instances across all namespaces.
   */
  private static _forEachGroup(callback: (group: NsFunctionGroup) => void) {
    for (const ns in Namespace._dict) {
      const namespace = Namespace._dict[ns];
      for (const groupName in namespace._groups) {
        callback(namespace._groups[groupName]);
      }
    }
  }

  static listenDesc(listener: DescListener): void {
    Namespace._descListeners.add(listener);
    globalFunctions.listenDesc(listener);
    Namespace._forEachGroup((group) => group.listenDesc(listener));
  }

  static unlistenDesc(listener: DescListener): void {
    Namespace._descListeners.delete(listener);
    globalFunctions.unlistenDesc(listener);
    Namespace._forEachGroup((group) => group.unlistenDesc(listener));
  }

  static getAllFunctionIds(): string[] {
    const result = globalFunctions.getAllFunctionIds();
    Namespace._forEachGroup((group) => {
      result.push(...group.getAllFunctionIds());
    });
    return result;
  }

  static getDescToSend(id: string): [FunctionDesc, number] {
    // Try globalFunctions first
    const [desc, size] = globalFunctions.getDescToSend(id);
    if (desc) {
      return [desc, size];
    }
    // Try namespace function groups
    const functionGroup = Namespace.getFunctionGroup(id);
    if (functionGroup) {
      return functionGroup.getDescToSend(id);
    }
    return [null, 0];
  }

  static clear(id: string): void {
    // Determine which function group owns this id
    const functionGroup = Namespace.getFunctionGroup(id);
    if (functionGroup) {
      functionGroup.clear(id);
    } else {
      globalFunctions.clear(id);
    }
  }

  static getFunctions(funcId: string, flow?: Flow, namespace?: string): FunctionGroup {
    const code0 = funcId.charCodeAt(0);
    if (code0 === 58 /* : */) {
      // local function
      return flow.getFuncGroup();
    } else if (code0 === 43 /* + */) {
      // namespace function
      if (funcId.charCodeAt(1) === 58 /* +: */) {
        // replace + with current namespace
        return Namespace.getFunctionGroup(flow?._namespace ?? namespace + funcId.substring(1));
      } else {
        return Namespace.getFunctionGroup(funcId);
      }
    } else if (code0 > 0) {
      // global function
      return globalFunctions;
    }
    return null;
  }

  static getWorker(id: string, flow?: Flow): [FunctionDesc, DataMap, PersistentFunctionGroup] {
    const functions = Namespace.getFunctions(id, flow);
    if (functions) {
      const workerData = functions.getWorkerData(id);
      if (workerData) {
        const [desc] = functions.getDescToSend(id);
        const functionGroup = functions instanceof PersistentFunctionGroup ? functions : null;
        return [desc, workerData, functionGroup];
      }
    }

    return [undefined, undefined, undefined];
  }

  static loadNameSpaces(namespaces: string[], unloadOthers = true) {
    const usedNs = new Set(namespaces);
    for (const ns of namespaces) {
      const namespace = Namespace.getNameSpace(ns);
      if (namespace) {
        namespace.load(usedNs);
      }
    }
    if (unloadOthers) {
      for (const ns in Namespace._dict) {
        if (!usedNs.has(ns)) {
          Namespace._dict[ns].unload();
        }
      }
    }
  }

  _groups: Record<string, NsFunctionGroup> = {};

  constructor(public readonly ns: string) {}
  _enabled: boolean = false;
  _loaded: boolean | 'loading' = false;
  async load(usedNs?: Set<string>) {
    this._enabled = true;
    if (this._loaded === false) {
      this._loaded = 'loading';
    }
    Namespace._rootInstance.addFlowFolder(this.ns);
    // todo: load namespace flows
  }
  unload() {
    this._enabled = false;
  }
  getGroup(group: string) {
    let g = this._groups[group];
    if (!g) {
      g = new NsFunctionGroup(this.ns, group, Namespace._storage);
      this._groups[group] = g;
      // Register any existing desc listeners on the new group
      for (const listener of Namespace._descListeners) {
        g.listenDesc(listener);
      }
      if (this._enabled) {
        g.loadFromStorage();
      }
    }
    return g;
  }
}
