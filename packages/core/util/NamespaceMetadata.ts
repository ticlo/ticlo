import type {NamespaceMetadata} from '../block/Storage.ts';
import {validFlowEntry} from './FlowStoragePath.ts';

export function validateNamespace(name: string): string {
  if (name !== '#root' && !validFlowEntry(name)) throw new Error(`Invalid namespace: ${name}`);
  return name;
}

export function namespacePrefix(name: string): string {
  validateNamespace(name);
  return name === '#root' ? '' : `+${name}.`;
}

export function readNamespaceMetadata(value: unknown): NamespaceMetadata {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid namespace metadata');
  const data = value as NamespaceMetadata & {serviceLibraries?: string[]};
  for (const field of ['dependencies', 'autoLoadLibraries', 'autoLoadFlows', 'serviceLibraries'] as const) {
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
      throw new Error(`Invalid namespace ${field}`);
  }
  const {serviceLibraries, ...metadata} = data;
  return serviceLibraries === undefined
    ? metadata
    : {...metadata, autoLoadLibraries: metadata.autoLoadLibraries ?? serviceLibraries};
}
