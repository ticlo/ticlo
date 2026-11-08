import type {FlowRef} from '@ticlo/core';
import {validFlowEntry} from '@ticlo/core/util/FlowStoragePath.ts';
import {libraryPrefix, validateLibrary} from '@ticlo/core/util/LibraryMetadata.ts';

export function pageFlowPath(params: URLSearchParams): {ref: FlowRef; path: string} | null {
  const value = params.get('path');
  if (value == null) return null;
  const slash = value.indexOf('/');
  if (slash < 1) throw new Error('Invalid page path');
  const library = validateLibrary(value.slice(0, slash));
  const name = value.slice(slash + 1).replaceAll('/', '.');
  if (!name.split('.').every(validFlowEntry)) throw new Error('Invalid page path');
  return {ref: {library, kind: 'flow', name}, path: `${libraryPrefix(library)}${name}`};
}

export function fileFlowPath(project: string, file: string): {ref: FlowRef; path: string} | null {
  if (!file.startsWith(`${project}/`) || !file.endsWith('.ticlo')) return null;
  const relative = file.slice(project.length + 1, -6);
  let ref: FlowRef;
  if (relative === '#context' && project !== '#root') {
    ref = {library: project, kind: 'flow', name: '#context'};
  } else if (relative.startsWith('#modules/') && validFlowEntry(relative.slice('#modules/'.length))) {
    ref = {library: project, kind: 'module', name: relative.slice('#modules/'.length)};
  } else {
    const names = relative.split('/');
    if (!names.every(validFlowEntry)) return null;
    ref = {library: project, kind: 'flow', name: names.join('.')};
  }
  const path = `${libraryPrefix(project)}${ref.kind === 'module' ? ':' : ''}${ref.name}`;
  return {ref, path};
}

export function fileDestination(project: string, directory: string, name: string, kind: FlowRef['kind']) {
  if (!validFlowEntry(name)) return null;
  const file = `${directory}/${name}.ticlo`;
  const target = fileFlowPath(project, file);
  return target?.ref.kind === kind ? {...target, file} : null;
}
