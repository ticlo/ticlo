import type {FlowRef} from '@ticlo/core';
import {validFlowEntry} from '@ticlo/core/util/FlowStoragePath.ts';
import {namespacePrefix, validateNamespace} from '@ticlo/core/util/NamespaceMetadata.ts';

export function pageFlowPath(params: URLSearchParams): {ref: FlowRef; path: string} | null {
  const value = params.get('path');
  if (value == null) return null;
  const slash = value.indexOf('/');
  if (slash < 1) throw new Error('Invalid page path');
  const namespace = validateNamespace(value.slice(0, slash));
  const name = value.slice(slash + 1).replaceAll('/', '.');
  if (!name.split('.').every(validFlowEntry)) throw new Error('Invalid page path');
  return {ref: {namespace, kind: 'flow', name}, path: `${namespacePrefix(namespace)}${name}`};
}

export function fileFlowPath(project: string, file: string): {ref: FlowRef; path: string} | null {
  if (!file.startsWith(`${project}/`) || !file.endsWith('.ticlo')) return null;
  const relative = file.slice(project.length + 1, -6);
  let ref: FlowRef;
  if (relative === '#context' && project !== '#root') {
    ref = {namespace: project, kind: 'flow', name: '#context'};
  } else if (relative.startsWith('#libs/') && validFlowEntry(relative.slice(6))) {
    ref = {namespace: project, kind: 'library', name: relative.slice(6)};
  } else {
    const names = relative.split('/');
    if (!names.every(validFlowEntry)) return null;
    ref = {namespace: project, kind: 'flow', name: names.join('.')};
  }
  const path = `${namespacePrefix(project)}${ref.kind === 'library' ? ':' : ''}${ref.name}`;
  return {ref, path};
}
