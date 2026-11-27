import {Flow, Root, flowRefFromPath, type FlowRef, voidFunction} from '@ticlo/core';

export type PageCloseMode = 'on' | 'off' | 'disable';
type HolderKind = 'stage' | 'include';

export const DEFAULT_MAX_PAGE_INSTANCES = 8;

interface PageEntry {
  includes: Set<object>;
  stages: Set<object>;
  closing?: 'off' | 'disable';
}

const rootPages = new WeakMap<Root, Map<string, PageEntry>>();

function getRootMap(root: Root, create = false): Map<string, PageEntry> | undefined {
  let map = rootPages.get(root);
  if (!map && create) {
    map = new Map();
    rootPages.set(root, map);
  }
  return map;
}

function getEntry(root: Root, key: string, create = false): PageEntry | undefined {
  const map = getRootMap(root, create);
  if (!map) return undefined;
  let entry = map.get(key);
  if (!entry && create) {
    entry = {includes: new Set(), stages: new Set()};
    map.set(key, entry);
  }
  return entry;
}

function cleanupEntry(root: Root, key: string, entry: PageEntry) {
  if (entry.includes.size === 0 && entry.stages.size === 0 && entry.closing === undefined) {
    rootPages.get(root)?.delete(key);
  }
}

export function getMaxPageInstances(flow: Flow): number {
  const max = flow.queryValue('#inputs.#maxInstance');
  return typeof max === 'number' && Number.isInteger(max) && max >= 1 ? max : DEFAULT_MAX_PAGE_INSTANCES;
}

/** Return a runtime-managed FlowRef for an ordinary storage-backed Flow, or null for modules/untracked flows. */
export function getManagedPageFlowRef(root: Root, flow: Flow | null | undefined): FlowRef | null {
  if (!flow || flow._destroyed || !root._storage) return null;
  if (flow.getValue('#is') !== 'flow:main') return null;
  const path = flow.getFullPath();
  if (!path || path === '#global' || path === '#temp' || path.startsWith('#temp.')) return null;
  let ref: FlowRef;
  try {
    ref = flowRefFromPath(path);
  } catch {
    return null;
  }
  if (ref.kind !== 'flow' || ref.name === '#context') return null;
  if (root.getFlowState(ref) === 'unloaded') return null;
  return ref;
}

export async function enterPageFlow(root: Root, ref: FlowRef, kind: HolderKind, token: object): Promise<Flow | null> {
  const key = root._lifecycle.key(ref);
  const entry = getEntry(root, key, true);
  const set = kind === 'include' ? entry.includes : entry.stages;

  set.add(token);
  entry.closing = undefined;

  let flow: Flow | null = null;
  try {
    if (root._storage) {
      flow = await root.loadFlow(ref);
    } else {
      const existing = root.queryValue(key);
      if (existing instanceof Flow && !existing._destroyed) {
        flow = existing;
      }
    }
  } catch (error) {
    set.delete(token);
    cleanupEntry(root, key, entry);
    throw error;
  }

  if (!flow || flow._destroyed || !set.has(token)) {
    set.delete(token);
    cleanupEntry(root, key, entry);
    return null;
  }

  if (kind === 'include') {
    const max = getMaxPageInstances(flow);
    let rank = 0;
    for (const item of set) {
      if (item === token) break;
      ++rank;
    }
    if (rank >= max) {
      set.delete(token);
      cleanupEntry(root, key, entry);
      return null;
    }
  }

  if (flow._runtimeDisabled) {
    flow._runtimeDisabled = undefined;
    flow._disabledChanged(flow.getValue('#disabled'));
  }
  return flow;
}

function applyClose(root: Root, ref: FlowRef, key: string, mode: 'off' | 'disable') {
  if (!root._storage) return;
  const state = root.getFlowState(ref);
  if (mode === 'off') {
    if (state !== 'unloaded') {
      void root.unloadFlow(ref).catch(voidFunction);
    }
    return;
  }
  if (state === 'enabled') {
    void root.disableFlow(ref).catch(voidFunction);
  } else if (state === 'loading') {
    void root.loadFlow(ref).then(() => {
      const cur = getEntry(root, key);
      if ((!cur || (cur.includes.size === 0 && cur.stages.size === 0)) && root.getFlowState(ref) === 'enabled') {
        void root.disableFlow(ref).catch(voidFunction);
      }
    }, voidFunction);
  }
}

export function leavePageFlow(root: Root, ref: FlowRef, kind: HolderKind, token: object, mode: PageCloseMode): void {
  const key = root._lifecycle.key(ref);
  const entry = getEntry(root, key);
  if (!entry) return;
  const set = kind === 'include' ? entry.includes : entry.stages;
  if (!set.delete(token)) return;
  if (entry.includes.size > 0 || entry.stages.size > 0) return;

  if (mode === 'on') {
    entry.closing = undefined;
    rootPages.get(root)?.delete(key);
    return;
  }

  const needSchedule = entry.closing === undefined;
  entry.closing = mode;
  if (needSchedule) {
    queueMicrotask(() => {
      const decision = entry.closing;
      entry.closing = undefined;
      if (!decision || entry.includes.size > 0 || entry.stages.size > 0) return;
      rootPages.get(root)?.delete(key);
      applyClose(root, ref, key, decision);
    });
  }
}
