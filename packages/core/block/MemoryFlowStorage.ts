import type {Flow, FlowLoader, Root} from './Flow.ts';
import type {FlowStorage, LibraryMetadata} from './Storage.ts';
import type {DataMap} from '../util/DataTypes.ts';
import {decode, encodeSorted} from '../util/Serialize.ts';
import {splitFlowStorageKey, validFlowEntry} from '../util/FlowStoragePath.ts';
import {readLibraryMetadata, validateLibrary} from '../util/LibraryMetadata.ts';
import {MemoryValueStorage} from '../storage/MemoryValueStorage.ts';

/** In-memory persistence survives stop/start on the same storage instance. */
export class MemoryFlowStorage implements FlowStorage {
  readonly flows = new Map<string, string>();
  readonly libraries = new Map<string, LibraryMetadata>([['#root', {}]]);
  inited = false;
  private readonly values = new Map<string, MemoryValueStorage>();
  getValueStorage(library: string) {
    let values = this.values.get(library);
    if (!values) this.values.set(library, (values = new MemoryValueStorage()));
    return values;
  }

  async getLibraryMetadata(library: string) {
    validateLibrary(library);
    if (!this.libraries.has(library)) throw new Error(`Missing library: ${library}`);
    return structuredClone(this.libraries.get(library));
  }
  async saveLibraryMetadata(library: string, metadata: LibraryMetadata) {
    validateLibrary(library);
    this.libraries.set(library, structuredClone(readLibraryMetadata(metadata)));
  }
  async listFlows(library: string) {
    validateLibrary(library);
    return [...this.flows.keys()]
      .flatMap((key) => {
        const [libraryId, name] = splitFlowStorageKey(key);
        return (libraryId || '#root') === library && name.split('.').every(validFlowEntry) ? [name] : [];
      })
      .sort();
  }
  delete(key: string) {
    this.flows.delete(key);
  }
  deleteFolder(key: string) {
    for (const name of this.flows.keys()) if (name.startsWith(`${key}.`)) this.flows.delete(name);
  }
  async loadFlow(key: string): Promise<DataMap | null> {
    return this.flows.has(key) ? decode(this.flows.get(key)) : null;
  }
  saveFlow(flow: Flow | null, data: DataMap | null, key: string) {
    this.flows.set(key, encodeSorted(data ?? flow.save()));
  }
  loadModule(libraryId: string, module: string) {
    return this.loadFlow(`${libraryId ? `${libraryId}.` : ''}:${module}`);
  }
  saveModule(libraryId: string, module: string, data: DataMap) {
    this.saveFlow(null, data, `${libraryId ? `${libraryId}.` : ''}:${module}`);
  }
  getFlowLoader(key: string): FlowLoader {
    return {
      applyChange: (flow) => {
        const data = flow.save();
        this.saveFlow(null, data, key);
        return data;
      },
    };
  }
  async init(root: Root) {
    root.loadGlobal((await this.loadFlow('#global')) ?? {}, this.getFlowLoader('#global').applyChange);
    this.inited = true;
  }
}
