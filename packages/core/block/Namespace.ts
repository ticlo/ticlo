import type {Flow, Root} from './Flow.ts';
import {Block} from './Block.ts';
import {FunctionLib, globalFunctions, getGlobalFunctionRoot, type DescListener} from './FunctionLib.ts';
import {FunctionDesc} from './Descriptor.ts';
import {DataMap} from '../util/DataTypes.ts';
import {NsFunctionLib} from './NSFunctionLib.ts';
import type {FlowStorage} from './Storage.ts';

export class Namespace {
  static setStorage(storage: FlowStorage) {
    getGlobalFunctionRoot()._storage = storage;
  }

  // return property for binding
  static bind(ns: string, flow?: Flow) {
    return this.rootOf(flow)?.getProperty(ns === '+#root' ? '' : ns);
  }
  static getNsRoot(ns: string) {
    if (!ns) {
      return globalFunctions.flow as Root;
    }
    const value = getGlobalFunctionRoot().getValue(ns);
    if (value instanceof Block) {
      return value;
    }
    return null;
  }

  static get _dict(): Record<string, Namespace> {
    return getGlobalFunctionRoot()._namespaces;
  }

  static rootOf(flow?: Flow): Root {
    if (!flow) return getGlobalFunctionRoot();
    while (flow._parent && flow._parent !== flow) flow = flow._parent._flow;
    return flow as Root;
  }

  static getNameSpace(ns: string, root = getGlobalFunctionRoot()) {
    // single character namespace is not allowed
    if (ns.length > 1) {
      let namespace = root._namespaces[ns];
      if (namespace == null) {
        namespace = new Namespace(ns, root);
        root._namespaces[ns] = namespace;
      }
      return namespace;
    }
    return undefined;
  }
  static getFunctionLib(id: string, root = getGlobalFunctionRoot(), autoload = true) {
    const parts = id.split(':');
    if (parts.length > 1) {
      const namespace = Namespace.getNameSpace(parts[0], root);
      if (namespace) {
        return namespace.getLib(parts[1], autoload);
      }
    }
    return undefined;
  }

  // --- Static aggregation methods covering globalFunctions + all NsFunctionLibs ---

  static get _descListeners() {
    return getGlobalFunctionRoot()._namespaceDescListeners;
  }

  /**
   * Iterate over all NsFunctionLib instances across all namespaces.
   */
  private static _forEachLib(callback: (lib: NsFunctionLib) => void, root = getGlobalFunctionRoot()) {
    for (const ns in root._namespaces) {
      const namespace = root._namespaces[ns];
      for (const libName in namespace._libs) {
        callback(namespace._libs[libName]);
      }
    }
  }

  static listenDesc(listener: DescListener, root = getGlobalFunctionRoot()): void {
    root._namespaceDescListeners.add(listener);
    globalFunctions.listenDesc(listener);
    Namespace._forEachLib((lib) => lib.listenDesc(listener), root);
  }

  static unlistenDesc(listener: DescListener, root = getGlobalFunctionRoot()): void {
    root._namespaceDescListeners.delete(listener);
    globalFunctions.unlistenDesc(listener);
    Namespace._forEachLib((lib) => lib.unlistenDesc(listener), root);
  }

  static getAllFunctionIds(root = getGlobalFunctionRoot()): string[] {
    const result = globalFunctions.getAllFunctionIds();
    Namespace._forEachLib((lib) => {
      result.push(...lib.getAllFunctionIds());
    }, root);
    return result;
  }

  static getDescToSend(id: string, root = getGlobalFunctionRoot()): [FunctionDesc, number] {
    // Try globalFunctions first
    const [desc, size] = globalFunctions.getDescToSend(id);
    if (desc) {
      return [desc, size];
    }
    // Try namespace function libs
    const functionLib = Namespace.getFunctionLib(id, root, false);
    if (functionLib) {
      return functionLib.getDescToSend(id);
    }
    return [null, 0];
  }

  static delete(id: string, root = getGlobalFunctionRoot()): void | Promise<void> {
    // Determine which function lib owns this id
    const functionLib = Namespace.getFunctionLib(id, root, false);
    if (functionLib) {
      functionLib.delete(id);
      return functionLib.pendingSave;
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
        const currentNamespace = flow?._namespace ?? namespace;
        return currentNamespace
          ? Namespace.getFunctionLib(`${currentNamespace}${funcId.substring(1)}`, Namespace.rootOf(flow))
          : undefined;
      } else {
        return Namespace.getFunctionLib(funcId, Namespace.rootOf(flow));
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

  static async loadNameSpaces(namespaces: string[], unloadOthers = true) {
    const root = getGlobalFunctionRoot();
    if (unloadOthers) await root.stop();
    for (const ns of namespaces) await root.enableNamespace(ns.replace(/^\+/, ''));
  }

  _libs: Record<string, NsFunctionLib> = Object.create(null);
  _enabled = false;

  constructor(
    public readonly ns: string,
    public readonly root = getGlobalFunctionRoot()
  ) {
    // Programmatically defined libraries remain usable without a storage-backed run.
    this._enabled = !root._storage && !root._lifecycle.started;
  }

  get name() {
    return this.ns === '+#root' ? '#root' : this.ns.slice(1);
  }

  getLib(libName: string, autoload = true) {
    let lib = this._libs[libName];
    if (!lib) {
      lib = new NsFunctionLib(undefined, this.ns, libName, this.root._storage);
      lib.setAvailable(false);
      this._libs[libName] = lib;
      for (const listener of this.root._namespaceDescListeners) lib.listenDesc(listener);
    }
    if (autoload && this._enabled && !lib.flow) {
      if (!this.root._storage && !this.root._lifecycle.started) {
        if (this.name !== '#root') this.root.addFlowFolder(this.ns, {});
        const flow = this.root.addFlowLib(this.ns, libName);
        lib.flow = flow;
        flow.load({'#is': ''}, null, undefined, undefined, this.ns, lib);
        lib.setAvailable(true);
      } else {
        this.root._lifecycle.loadLibraryOnDemand(this.name, libName);
      }
    }
    return lib;
  }
}
