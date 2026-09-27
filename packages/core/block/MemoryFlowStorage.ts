import type {Flow, FlowLoader, Root} from './Flow.ts';
import type {FlowStorage, NamespaceMetadata} from './Storage.ts';
import type {DataMap} from '../util/DataTypes.ts';
import {decode, encodeSorted} from '../util/Serialize.ts';
import {splitFlowStorageKey, validFlowEntry} from '../util/FlowStoragePath.ts';
import {readNamespaceMetadata, validateNamespace} from '../util/NamespaceMetadata.ts';

/** In-memory persistence survives stop/start on the same storage instance. */
export class MemoryFlowStorage implements FlowStorage {
  readonly flows = new Map<string, string>();
  readonly namespaces = new Map<string, NamespaceMetadata>([['#root', {}]]);
  inited = false;

  async getNamespaceMetadata(namespace: string) {
    validateNamespace(namespace);
    if (!this.namespaces.has(namespace)) throw new Error(`Missing namespace: ${namespace}`);
    return structuredClone(this.namespaces.get(namespace));
  }
  async saveNamespaceMetadata(namespace: string, metadata: NamespaceMetadata) {
    validateNamespace(namespace);
    this.namespaces.set(namespace, structuredClone(readNamespaceMetadata(metadata)));
  }
  async listFlows(namespace: string) {
    validateNamespace(namespace);
    return [...this.flows.keys()]
      .flatMap((key) => {
        const [ns, name] = splitFlowStorageKey(key);
        return (ns || '#root') === namespace && name.split('.').every(validFlowEntry) ? [name] : [];
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
  loadLib(ns: string, lib: string) {
    return this.loadFlow(`${ns ? `${ns}.` : ''}:${lib}`);
  }
  saveLib(ns: string, lib: string, data: DataMap) {
    this.saveFlow(null, data, `${ns ? `${ns}.` : ''}:${lib}`);
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
