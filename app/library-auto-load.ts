import type {Root} from '@ticlo/core';
import {flowRefFromPath} from '@ticlo/core/block/FlowRuntime.ts';
import type {LibraryAutoLoad} from '@ticlo/editor/node-tree/NodeTree.tsx';

export function createLibraryAutoLoad(root: Root): LibraryAutoLoad {
  const library = (path: string) => {
    const ref = flowRefFromPath(path);
    if (ref.kind !== 'library') throw new Error(`Not a library: ${path}`);
    return ref;
  };
  return {
    get: async (path) => {
      const {namespace, name} = library(path);
      return (await root.getNamespaceMetadata(namespace)).autoLoadLibraries?.includes(name) ?? false;
    },
    set: async (path, enabled) => {
      const {namespace, name} = library(path);
      await root.setAutoLoadLibrary(namespace, name, enabled);
    },
  };
}
