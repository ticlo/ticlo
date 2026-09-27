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

/** Relative to a project/namespace directory. Worker subflow suffixes stay on the file. */
export function flowStoragePath(key: string, folder = false): string {
  if (!folder && key.startsWith(':')) return `#libs/${encodeFileName(key.slice(1))}.ticlo`;
  const suffixIndex = folder ? -1 : key.indexOf('.#');
  const name = suffixIndex < 0 ? key : key.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? '' : key.slice(suffixIndex);
  const parts = name.split('.');
  if ((folder || parts.length > 1) && reservedFlowFolders.has(parts[0])) {
    throw new Error(`Reserved folder: ${parts[0]}`);
  }
  if (!parts.every(validFlowEntry) && !(parts.length === 1 && name === '#global' && !folder)) {
    throw new Error('Invalid flow path');
  }
  return parts.map(encodeFileName).join('/') + encodeFileName(suffix) + (folder ? '' : '.ticlo');
}
