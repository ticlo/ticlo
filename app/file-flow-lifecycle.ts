import type {Root} from '@ticlo/core';
import type {DockLayout, TabData} from 'rc-dock';
import {flowStoragePath} from '@ticlo/core/util/FlowStoragePath.ts';
import {type FileAccess, StorageError} from '@ticlo/core/storage/FileAccess.ts';
import {fileFlowPath} from './flow-path.ts';

export async function unloadDeletedFileFlows(root: Root, layout: DockLayout, project: string, files: string[]) {
  for (const file of files) {
    const target = fileFlowPath(project, file);
    if (!target) continue;
    await root.unloadFlow(target.ref, {discardChanges: true});
    for (const id of [`blockEditor:${target.path}`, `designer:${target.path}`]) {
      const tab = layout.find(id) as TabData | undefined;
      if (tab) layout.dockMove(tab, null, 'remove');
    }
  }
}

export async function reloadDiscardedFileFlow(root: Root, project: string, file: string) {
  const target = fileFlowPath(project, file);
  if (!target || root.getFlowState(target.ref) === 'unloaded') return;
  await root.unloadFlow(target.ref, {discardChanges: true});
  await root.loadFlow(target.ref);
}

export async function resetProjectFlows(root: Root, layout: DockLayout, storage: FileAccess, project: string) {
  for (const ref of root.getLoadedFlowRefs(project)) {
    const name = ref.kind === 'module' ? `:${ref.name}` : ref.name;
    const file = `${project}/${flowStoragePath(name)}`;
    let exists = false;
    try {
      exists = (await storage.getFileInfo(file)).gitStatus !== 'deleted';
    } catch (error) {
      if (!(error instanceof StorageError && error.code === 'not-found')) throw error;
    }
    if (exists) await reloadDiscardedFileFlow(root, project, file);
    else await unloadDeletedFileFlows(root, layout, project, [file]);
  }
}
