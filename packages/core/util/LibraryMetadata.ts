import type {LibraryMetadata} from '../block/Storage.ts';
import {validFlowEntry} from './FlowStoragePath.ts';

export function validateLibrary(name: string): string {
  if (name !== '#root' && !validFlowEntry(name)) throw new Error(`Invalid library: ${name}`);
  return name;
}

export function libraryPrefix(name: string): string {
  validateLibrary(name);
  return name === '#root' ? '' : `+${name}.`;
}

export function libraryPath(name: string): string {
  return libraryPrefix(name).slice(0, -1);
}

export function libraryFromPath(path: string): string {
  if (path === '') return '#root';
  if (!path.startsWith('+') || path === '+#root') throw new Error('Invalid library path');
  return validateLibrary(path.slice(1));
}

export function readLibraryMetadata(value: unknown): LibraryMetadata {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid library metadata');
  const data = value as LibraryMetadata;
  for (const field of ['dependencies', 'autoLoadModules', 'autoLoadFlows'] as const) {
    const entries = data[field];
    if (
      entries !== undefined &&
      (!Array.isArray(entries) ||
        !entries.every(
          (entry) =>
            typeof entry === 'string' &&
            (field === 'dependencies'
              ? entry === '#root' || validFlowEntry(entry)
              : field === 'autoLoadFlows'
                ? entry.split('.').every(validFlowEntry)
                : validFlowEntry(entry))
        ))
    )
      throw new Error(`Invalid library ${field}`);
  }
  return data;
}
