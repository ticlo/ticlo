import {DataMap, decode, encodeSorted, Flow, Root, FlowStorage, Storage} from '@ticlo/core';
import {NamespaceMetadata} from '@ticlo/core/block/Storage.ts';
import {readNamespaceMetadata, validateNamespace} from '@ticlo/core/util/NamespaceMetadata.ts';
import {FlowLoader} from '@ticlo/core/block/Flow.ts';
import {StreamDispatcher} from '@ticlo/core/block/Dispatcher.ts';
import {encodeFileName, validateNodePath} from '@ticlo/core/util/Path.ts';
import {
  flowStoragePath,
  reservedFlowFolders,
  splitFlowStorageKey,
  validFlowEntry,
} from '@ticlo/core/util/FlowStoragePath.ts';

/** Reads static files over HTTP. Writes and deletions last only for this instance. */
export class StaticStorage implements Storage {
  readonly dir: string;
  readonly values = new Map<string, string>();
  readonly streams = new Map<string, StreamDispatcher<string>>();

  constructor(
    dir: string,
    public readonly ext: string = ''
  ) {
    this.dir = dir.replace(/\/+$/, '');
  }

  getUrl(name: string) {
    return `${this.dir}/${encodeURIComponent(`${encodeFileName(name)}${this.ext}`)}`;
  }

  delete(key: string) {
    // Keep a tombstone so subsequent reads cannot restore the remote file.
    this.values.set(key, null);
    this.streams.get(key)?.dispatch(null);
  }

  save(key: string, data: string) {
    this.values.set(key, data);
    this.streams.get(key)?.dispatch(data);
  }

  async load(key: string): Promise<string> {
    if (this.values.has(key)) {
      return this.values.get(key);
    }
    let data: string = null;
    try {
      const response = await fetch(this.getUrl(key));
      if (response.ok) {
        data = await response.text();
      }
    } catch {
      // Match the other storage implementations for missing or unreadable files.
    }
    // A save or delete may have happened while the request was in flight.
    return this.values.has(key) ? this.values.get(key) : data;
  }

  listen(key: string, listener: (val: string) => void) {
    let stream = this.streams.get(key);
    if (!stream) {
      stream = new StreamDispatcher<string>();
      this.streams.set(key, stream);
    }
    stream.listen(listener);
  }

  unlisten(key: string, listener: (val: string) => void) {
    const stream = this.streams.get(key);
    if (stream) {
      stream.unlisten(listener);
      if (stream.isEmpty()) {
        this.streams.delete(key);
      }
    }
  }
}

const ROOT_PROJECT = '#root';
function validProject(id: string) {
  return Boolean(id) && validateNodePath(id);
}

export class StaticFlowStorage extends StaticStorage implements FlowStorage {
  inited = false;
  readonly projects = new Set<string>();
  private readonly deletedFolders = new Set<string>();

  constructor(
    dir: string,
    public readonly initialProject = ROOT_PROJECT
  ) {
    super(dir, '.ticlo');
    if (!validProject(initialProject)) throw new Error('Invalid project id');
  }

  getUrl(key: string) {
    const [namespace, name] = splitFlowStorageKey(key);
    const file = flowStoragePath(name).split('/').map(encodeURIComponent).join('/');
    return `${this.dir}/proj/${encodeURIComponent(namespace || ROOT_PROJECT)}/${file}`;
  }

  createFolder(key: string) {
    flowStoragePath(splitFlowStorageKey(key)[1], true);
  }

  deleteFolder(key: string) {
    this.createFolder(key);
    this.deletedFolders.add(`${key}.`);
    for (const entry of this.values.keys()) {
      if (entry.startsWith(`${key}.`)) this.delete(entry);
    }
  }

  async load(key: string) {
    const data = await super.load(key);
    if (!this.values.has(key) && [...this.deletedFolders].some((prefix) => key.startsWith(prefix))) return null;
    return data;
  }

  getFlowLoader(key: string): FlowLoader {
    this.getUrl(key);
    return {
      applyChange: (flow: Flow) => {
        const data = flow.save();
        this.saveFlow(null, data, key);
        return data;
      },
    };
  }

  saveFlow(flow: Flow | null, data: DataMap | null, key: string) {
    this.save(key, encodeSorted(data ?? flow?.save()));
  }

  async loadFlow(name: string): Promise<DataMap | null> {
    try {
      return decode(await this.load(name));
    } catch {
      return null;
    }
  }

  saveLib(ns: string, lib: string, data: DataMap) {
    this.saveFlow(null, data, `${ns ? `${ns}.` : ''}:${lib}`);
  }

  loadLib(ns: string, lib: string) {
    return this.loadFlow(`${ns ? `${ns}.` : ''}:${lib}`);
  }

  private async listFolder(path: string): Promise<string[]> {
    const url = `${this.dir}/${path.split('/').map(encodeURIComponent).join('/')}/.list.json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
    }
    const files: unknown = await response.json();
    if (!Array.isArray(files) || !files.every((file) => typeof file === 'string')) {
      throw new Error(`${url} must contain an array of filenames`);
    }
    return files;
  }

  readonly persistent = false;

  async getNamespaceMetadata(namespace: string): Promise<NamespaceMetadata> {
    validateNamespace(namespace);
    const files = await this.listFolder(`proj/${namespace}`);
    this.projects.add(namespace);
    if (!files.includes('ticlo.json')) return {};
    const url = `${this.dir}/proj/${encodeURIComponent(namespace)}/ticlo.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
    return readNamespaceMetadata(await response.json());
  }

  async saveNamespaceMetadata(namespace: string, metadata: NamespaceMetadata): Promise<void> {
    throw new Error('StaticStorage does not support persistence');
  }

  async listFlows(namespace: string, folders?: string[]): Promise<string[]> {
    validateNamespace(namespace);
    const result = new Set<string>();
    const visit = async (path: string, prefix = '') => {
      for (const file of await this.listFolder(path)) {
        if (file.endsWith('/') && validFlowEntry(file.slice(0, -1))) {
          const name = file.slice(0, -1);
          folders?.push(`${prefix}${name}`);
          await visit(`${path}/${name}`, `${prefix}${name}.`);
        } else if (file.endsWith(this.ext)) {
          const name = file.slice(0, -this.ext.length);
          if (validFlowEntry(name)) result.add(`${prefix}${name}`);
        }
      }
    };
    await visit(`proj/${namespace}`);
    const prefix = namespace === '#root' ? '' : `+${namespace}.`;
    for (const [key, value] of this.values) {
      const [ns, name] = splitFlowStorageKey(key);
      if ((ns || '#root') === namespace && name.split('.').every(validFlowEntry)) {
        if (value == null) result.delete(name);
        else result.add(name);
      }
    }
    return [...result]
      .filter((name) => ![...this.deletedFolders].some((folder) => `${prefix}${name}`.startsWith(folder)))
      .sort();
  }

  async init(root: Root) {
    await this.listFolder(`proj/${ROOT_PROJECT}`);
    const globalData = await this.loadFlow('#global');
    root.loadGlobal(globalData ?? {'#is': ''}, this.getFlowLoader('#global').applyChange);
    this.inited = true;
  }
}
