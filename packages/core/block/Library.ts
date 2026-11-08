import type {Flow, Root} from './Flow.ts';
import {Block} from './Block.ts';
import {FunctionModule, globalFunctions, getGlobalFunctionRoot, type DescListener} from './FunctionModule.ts';
import {FunctionDesc} from './Descriptor.ts';
import {DataMap} from '../util/DataTypes.ts';
import {LibraryFunctionModule} from './LibraryFunctionModule.ts';
import type {FlowStorage} from './Storage.ts';

export class Library {
  static setStorage(storage: FlowStorage) {
    getGlobalFunctionRoot()._storage = storage;
  }

  // return property for binding
  static bind(libraryId: string, flow?: Flow) {
    return this.rootOf(flow)?.getProperty(libraryId === '+#root' ? '' : libraryId);
  }
  static getLibraryRoot(libraryId: string) {
    if (!libraryId) {
      return globalFunctions.flow as Root;
    }
    const value = getGlobalFunctionRoot().getValue(libraryId);
    if (value instanceof Block) {
      return value;
    }
    return null;
  }

  static get _dict(): Record<string, Library> {
    return getGlobalFunctionRoot()._libraries;
  }

  static rootOf(flow?: Flow): Root {
    if (!flow) return getGlobalFunctionRoot();
    while (flow._parent && flow._parent !== flow) flow = flow._parent._flow;
    return flow as Root;
  }

  static getLibrary(libraryId: string, root = getGlobalFunctionRoot()) {
    // single character library is not allowed
    if (libraryId.length > 1) {
      let library = root._libraries[libraryId];
      if (library == null) {
        library = new Library(libraryId, root);
        root._libraries[libraryId] = library;
      }
      return library;
    }
    return undefined;
  }
  static getFunctionModule(id: string, root = getGlobalFunctionRoot(), autoload = true) {
    const parts = id.split(':');
    if (parts.length > 1) {
      const library = Library.getLibrary(parts[0], root);
      if (library) {
        return library.getModule(parts[1], autoload);
      }
    }
    return undefined;
  }

  // --- Static aggregation methods covering globalFunctions + all LibraryFunctionModules ---

  static get _descListeners() {
    return getGlobalFunctionRoot()._libraryDescListeners;
  }

  /**
   * Iterate over all LibraryFunctionModule instances across all libraries.
   */
  private static _forEachModule(callback: (module: LibraryFunctionModule) => void, root = getGlobalFunctionRoot()) {
    for (const libraryId in root._libraries) {
      const library = root._libraries[libraryId];
      for (const moduleName in library._modules) {
        callback(library._modules[moduleName]);
      }
    }
  }

  static listenDesc(listener: DescListener, root = getGlobalFunctionRoot()): void {
    root._libraryDescListeners.add(listener);
    globalFunctions.listenDesc(listener);
    Library._forEachModule((module) => module.listenDesc(listener), root);
  }

  static unlistenDesc(listener: DescListener, root = getGlobalFunctionRoot()): void {
    root._libraryDescListeners.delete(listener);
    globalFunctions.unlistenDesc(listener);
    Library._forEachModule((module) => module.unlistenDesc(listener), root);
  }

  static getAllFunctionIds(root = getGlobalFunctionRoot()): string[] {
    const result = globalFunctions.getAllFunctionIds();
    Library._forEachModule((module) => {
      result.push(...module.getAllFunctionIds());
    }, root);
    return result;
  }

  static getDescToSend(id: string, root = getGlobalFunctionRoot()): [FunctionDesc, number] {
    // Try globalFunctions first
    const [desc, size] = globalFunctions.getDescToSend(id);
    if (desc) {
      return [desc, size];
    }
    // Try library function modules
    const functionModule = Library.getFunctionModule(id, root, false);
    if (functionModule) {
      return functionModule.getDescToSend(id);
    }
    return [null, 0];
  }

  static delete(id: string, root = getGlobalFunctionRoot()): void | Promise<void> {
    // Determine which function module owns this id
    const functionModule = Library.getFunctionModule(id, root, false);
    if (functionModule) {
      functionModule.delete(id);
      return functionModule.pendingSave;
    } else {
      globalFunctions.delete(id);
    }
  }

  static getFunctions(funcId: string, flow?: Flow, library?: string): FunctionModule {
    const code0 = funcId.charCodeAt(0);
    // Function ids encode their lookup scope:
    // :id lives in the current flow's #functions, +libraryId:module:id lives in a
    // library worker module, and every other non-empty id is global.
    if (code0 === 58 /* : */) {
      // in-flow function
      return flow.getFuncModule();
    } else if (code0 === 43 /* + */) {
      // library function
      if (funcId.charCodeAt(1) === 58 /* +: */) {
        // replace + with current library
        const currentLibrary = flow?._library ?? library;
        return currentLibrary
          ? Library.getFunctionModule(`${currentLibrary}${funcId.substring(1)}`, Library.rootOf(flow))
          : undefined;
      } else {
        return Library.getFunctionModule(funcId, Library.rootOf(flow));
      }
    } else if (code0 > 0) {
      // global function
      return globalFunctions;
    }
    return null;
  }

  static getWorker(id: string, flow?: Flow): [FunctionDesc, DataMap, FunctionModule] {
    const functions = Library.getFunctions(id, flow);
    if (functions) {
      const workerData = functions.getWorkerData(id);
      if (workerData) {
        const [desc] = functions.getDescToSend(id);
        return [desc, workerData, functions];
      }
    }

    return [undefined, undefined, undefined];
  }

  static async loadLibraries(libraries: string[], unloadOthers = true) {
    const root = getGlobalFunctionRoot();
    if (unloadOthers) await root.stop();
    for (const libraryId of libraries) await root.enableLibrary(libraryId.replace(/^\+/, ''));
  }

  _modules: Record<string, LibraryFunctionModule> = Object.create(null);
  _enabled = false;

  constructor(
    public readonly libraryId: string,
    public readonly root = getGlobalFunctionRoot()
  ) {
    // Programmatically defined modules remain usable without a storage-backed run.
    this._enabled = !root._storage && !root._lifecycle.started;
  }

  get name() {
    return this.libraryId === '+#root' ? '#root' : this.libraryId.slice(1);
  }

  getModule(moduleName: string, autoload = true) {
    let module = this._modules[moduleName];
    if (!module) {
      module = new LibraryFunctionModule(undefined, this.libraryId, moduleName, this.root._storage);
      module.setAvailable(false);
      this._modules[moduleName] = module;
      for (const listener of this.root._libraryDescListeners) module.listenDesc(listener);
    }
    if (autoload && this._enabled && !module.flow) {
      if (!this.root._storage && !this.root._lifecycle.started) {
        if (this.name !== '#root') this.root.addFlowFolder(this.libraryId, {});
        const flow = this.root.addFlowModule(this.libraryId, moduleName);
        module.flow = flow;
        flow.load({'#is': ''}, null, undefined, undefined, this.libraryId, module);
        module.setAvailable(true);
      } else {
        this.root._lifecycle.loadModuleOnDemand(this.name, moduleName);
      }
    }
    return module;
  }
}
