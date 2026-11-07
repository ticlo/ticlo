import type {Root} from '@ticlo/core';
import type {DockLayout, TabData} from 'rc-dock';
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
