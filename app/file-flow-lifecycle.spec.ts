import {describe, expect, it, vi} from 'vitest';
import type {Root} from '@ticlo/core';
import {StorageError, type FileAccess} from '@ticlo/core/storage/FileAccess.ts';
import {reloadDiscardedFileFlow, resetProjectFlows, unloadDeletedFileFlows} from './file-flow-lifecycle.ts';

describe('file flow lifecycle', () => {
  it('unloads a deleted flow and discards unsaved changes', async () => {
    const unloadFlow = vi.fn(async () => {});
    const root = {unloadFlow} as unknown as Root;

    await unloadDeletedFileFlows(root, 'demo', ['demo/jobs/run.ticlo']);

    expect(unloadFlow).toHaveBeenCalledWith({library: 'demo', kind: 'flow', name: 'jobs.run'}, {discardChanges: true});
  });

  it('reloads a loaded flow after its stored changes are discarded', async () => {
    const unloadFlow = vi.fn(async () => {});
    const loadFlow = vi.fn(async () => {});
    const getFlowState = vi.fn(() => 'enabled');
    const root = {unloadFlow, loadFlow, getFlowState} as unknown as Root;
    const ref = {library: 'demo', kind: 'flow', name: 'jobs.run'};

    await reloadDiscardedFileFlow(root, 'demo', 'demo/jobs/run.ticlo');
    expect(unloadFlow).toHaveBeenCalledWith(ref, {discardChanges: true});
    expect(loadFlow).toHaveBeenCalledWith(ref);
    expect(unloadFlow.mock.invocationCallOrder[0]).toBeLessThan(loadFlow.mock.invocationCallOrder[0]);

    getFlowState.mockReturnValue('unloaded');
    await reloadDiscardedFileFlow(root, 'demo', 'demo/jobs/run.ticlo');
    expect(loadFlow).toHaveBeenCalledTimes(1);
  });

  it('refreshes surviving flows and unloads removed flows after a project reset', async () => {
    const refs = ['keep', 'removed'].map((name) => ({library: 'demo', kind: 'flow' as const, name}));
    const root = {
      getLoadedFlowRefs: () => refs,
      getFlowState: () => 'enabled',
      unloadFlow: vi.fn(async () => {}),
      loadFlow: vi.fn(async () => {}),
    } as unknown as Root;
    const storage = {
      getFileInfo: vi.fn(async (file: string) => {
        if (file.endsWith('removed.ticlo')) throw new StorageError('missing', 'not-found');
        return {path: file, name: 'keep.ticlo', type: 'file'};
      }),
    } as unknown as FileAccess;
    await resetProjectFlows(root, storage, 'demo');
    expect(root.loadFlow).toHaveBeenCalledExactlyOnceWith(refs[0]);
    expect(root.unloadFlow).toHaveBeenCalledWith(refs[1], {discardChanges: true});
  });
});
