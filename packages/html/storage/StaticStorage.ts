import {DataMap, decode, encodeSorted, Flow, Root, FlowStorage, Storage} from '@ticlo/core';
import {FlowLoader} from '@ticlo/core/block/Flow.ts';
import {StreamDispatcher} from '@ticlo/core/block/Dispatcher.ts';
import {encodeFileName, validateNodePath} from '@ticlo/core/util/Path.ts';

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

const ROOT_PROJECT = '_root';
function validProject(id: string) {
  return Boolean(id) && validateNodePath(id);
}

export class StaticFlowStorage extends StaticStorage implements FlowStorage {
  inited = false;
  readonly projects = new Set<string>();

  constructor(
    dir: string,
    public readonly initialProject = ROOT_PROJECT
  ) {
    super(dir, '.ticlo');
    if (!validProject(initialProject)) throw new Error('Invalid project id');
  }

  getUrl(key: string) {
    let project = ROOT_PROJECT;
    if (key.startsWith('+')) {
      const dot = key.indexOf('.');
      project = key.slice(1, dot);
      key = key.slice(dot + 1);
      if (dot < 2 || !validProject(project)) throw new Error('Invalid namespace');
    }
    const library = key.startsWith(':');
    const file = encodeURIComponent(`${encodeFileName(library ? key.slice(1) : key)}${this.ext}`);
    return `${this.dir}/proj/${encodeURIComponent(project)}/${library ? 'libs/' : ''}${file}`;
  }

  getFlowLoader(key: string): FlowLoader {
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
    const url = `${this.dir}/${path}/.list.json`;
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

  async init(root: Root) {
    const rootFiles = await this.listFolder(`proj/${ROOT_PROJECT}`);
    const globalData = await this.loadFlow('#global');
    root.loadGlobal(globalData ?? {'#is': ''}, this.getFlowLoader('#global').applyChange);

    const loadProject = async (project: string) => {
      if (this.projects.has(project)) return;
      const path = `proj/${encodeURIComponent(project)}`;
      const files = project === ROOT_PROJECT ? rootFiles : await this.listFolder(path);
      this.projects.add(project);
      if (project !== ROOT_PROJECT) root.addFlowFolder(`+${project}`);
      if (files.includes('deps/')) {
        const deps = await this.listFolder(`${path}/deps`);
        for (const entry of deps.sort()) {
          const id = entry.slice(0, -1);
          if (entry.endsWith('/') && validProject(id)) await loadProject(id);
        }
      }
      const names = files.filter((file) => file.endsWith(this.ext)).map((file) => file.slice(0, -this.ext.length));
      for (const name of names.sort()) {
        // Subflows and libraries load on demand; invalid filenames are ignored.
        if (!name.split('.').every((part) => part && validateNodePath(part) && !/^[#+:]/.test(part))) continue;
        const key = project === ROOT_PROJECT ? name : `+${project}.${name}`;
        const data = await this.loadFlow(key);
        if (data) root.addFlow(key, data, null, true);
      }
    };
    await loadProject(this.initialProject);
    this.inited = true;
  }
}
