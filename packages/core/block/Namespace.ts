import type {Flow, Root} from './Flow.js';
import {Block} from './Block.js';
import {FunctionDispatcher, FunctionLib, globalFunctions, type DescListener} from './FunctionLib.js';
import {FunctionClass} from './BlockFunction.js';
import {PropListener} from './Dispatcher.js';
import {FunctionDesc} from './Descriptor.js';
import {DataMap} from '../util/DataTypes.js';
import {NsFunctionLib} from './NSFunctionLib.js';
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
  static getFunctionLib(id: string) {
    const parts = id.split(':');
    if (parts.length > 1) {
      const namespace = Namespace.getNameSpace(parts[0]);
      if (namespace) {
        return namespace.getLib(parts[1]);
      }
    }
    return undefined;
  }

  // --- Static aggregation methods covering globalFunctions + all NsFunctionLibs ---

  static _descListeners: Set<DescListener> = new Set<DescListener>();

  /**
   * Iterate over all NsFunctionLib instances across all namespaces.
   */
  private static _forEachLib(callback: (lib: NsFunctionLib) => void) {
    for (const ns in Namespace._dict) {
      const namespace = Namespace._dict[ns];
      for (const libName in namespace._libs) {
        callback(namespace._libs[libName]);
      }
    }
  }

  static listenDesc(listener: DescListener): void {
    Namespace._descListeners.add(listener);
    globalFunctions.listenDesc(listener);
    Namespace._forEachLib((lib) => lib.listenDesc(listener));
  }

  static unlistenDesc(listener: DescListener): void {
    Namespace._descListeners.delete(listener);
    globalFunctions.unlistenDesc(listener);
    Namespace._forEachLib((lib) => lib.unlistenDesc(listener));
  }

  static getAllFunctionIds(): string[] {
    const result = globalFunctions.getAllFunctionIds();
    Namespace._forEachLib((lib) => {
      result.push(...lib.getAllFunctionIds());
    });
    return result;
  }

  static getDescToSend(id: string): [FunctionDesc, number] {
    // Try globalFunctions first
    const [desc, size] = globalFunctions.getDescToSend(id);
    if (desc) {
      return [desc, size];
    }
    // Try namespace function libs
    const functionLib = Namespace.getFunctionLib(id);
    if (functionLib) {
      return functionLib.getDescToSend(id);
    }
    return [null, 0];
  }

  static delete(id: string): void {
    // Determine which function lib owns this id
    const functionLib = Namespace.getFunctionLib(id);
    if (functionLib) {
      functionLib.delete(id);
    } else {
      globalFunctions.delete(id);
    }
  }

  static getFunctions(funcId: string, flow?: Flow, namespace?: string): FunctionLib {
    const code0 = funcId.charCodeAt(0);
    // Function ids encode their lookup scope:
    // :id lives in the current flow's #functions, +ns:lib:id lives in a
    // namespace worker lib, and every other non-empty id is global.
    if (code0 === 58 /* : */) {
      // in-flow function
      return flow.getFuncLib();
    } else if (code0 === 43 /* + */) {
      // namespace function
      if (funcId.charCodeAt(1) === 58 /* +: */) {
        // replace + with current namespace
        return Namespace.getFunctionLib(flow?._namespace ?? namespace + funcId.substring(1));
      } else {
        return Namespace.getFunctionLib(funcId);
      }
    } else if (code0 > 0) {
      // global function
      return globalFunctions;
    }
    return null;
  }

  static getWorker(id: string, flow?: Flow): [FunctionDesc, DataMap, FunctionLib] {
    const functions = Namespace.getFunctions(id, flow);
    if (functions) {
      const workerData = functions.getWorkerData(id);
      if (workerData) {
        const [desc] = functions.getDescToSend(id);
        return [desc, workerData, functions];
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

  _libs: Record<string, NsFunctionLib> = {};

  constructor(public readonly ns: string) {
    Namespace._rootInstance.addFlowFolder(ns);
  }
  _enabled: boolean = false;
  _loaded: boolean | 'loading' = false;
  async load(usedNs?: Set<string>) {
    this._enabled = true;
    if (this._loaded === false) {
      this._loaded = 'loading';
    }
    // todo: load namespace flows
  }
  unload() {
    this._enabled = false;
  }
  getLib(libName: string) {
    let lib = this._libs[libName];
    if (!lib) {
      const flow = Namespace._rootInstance.addFlowLib(this.ns, libName);
      lib = flow?.getFuncLib() as NsFunctionLib;
      if (!lib) {
        lib = new NsFunctionLib(this.ns, libName, Namespace._storage, flow);
      }
      if (flow && !flow._loaded) {
        flow.load(
          {'#is': ''},
          null,
          Namespace._storage
            ? (changedFlow: Flow) => {
                const data = changedFlow.save();
                Namespace._storage.saveLib(this.ns, libName, data);
                return data;
              }
            : undefined,
          undefined,
          undefined,
          lib
        );
      }
      this._libs[libName] = lib;
      // Register any existing desc listeners on the new lib
      for (const listener of Namespace._descListeners) {
        lib.listenDesc(listener);
      }
      if (flow && Namespace._storage) {
        Namespace._storage.loadLib(this.ns, libName).then((data) => {
          if (data) {
            flow.liveUpdate(data);
          }
        });
      }
    }
    return lib;
  }
}
