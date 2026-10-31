import {encodeFileName, validateNodePath} from './Path.ts';

export const reservedFlowFolders = new Set(['#libs', '#deps', '#storage']);

export function validFlowEntry(name: string): boolean {
  return Boolean(name) && validateNodePath(name) && !/^[#+:]/.test(name);
}

export function splitFlowStorageKey(key: string): [string, string] {
  if (!key.startsWith('+')) return ['', key];
  const dot = key.indexOf('.');
  const namespace = key.slice(1, dot);
  if (dot < 2 || !validateNodePath(namespace)) throw new Error('Invalid namespace');
  return [namespace, key.slice(dot + 1)];
}

/** Relative to a project/namespace directory. */
export function flowStoragePath(key: string, folder = false): string {
  if (!folder && key.startsWith(':')) return `#libs/${encodeFileName(key.slice(1))}.ticlo`;
  const parts = key.split('.');
  if ((folder || parts.length > 1) && reservedFlowFolders.has(parts[0])) {
    throw new Error(`Reserved folder: ${parts[0]}`);
  }
  if (!parts.every(validFlowEntry) && !(parts.length === 1 && (key === '#global' || key === '#context') && !folder)) {
    throw new Error('Invalid flow path');
  }
  return parts.map(encodeFileName).join('/') + (folder ? '' : '.ticlo');
}
