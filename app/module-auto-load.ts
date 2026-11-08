import type {Root} from '@ticlo/core';
import {flowRefFromPath} from '@ticlo/core/block/FlowRuntime.ts';
import type {ModuleAutoLoad} from '@ticlo/editor/node-tree/NodeTree.tsx';

export function createModuleAutoLoad(root: Root): ModuleAutoLoad {
  const module = (path: string) => {
    const ref = flowRefFromPath(path);
    if (ref.kind !== 'module') throw new Error(`Not a module: ${path}`);
    return ref;
  };
  return {
    get: async (path) => {
      const {library, name} = module(path);
      return (await root.getLibraryMetadata(library)).autoLoadModules?.includes(name) ?? false;
    },
    set: async (path, enabled) => {
      const {library, name} = module(path);
      await root.setAutoLoadModule(library, name, enabled);
    },
  };
}
