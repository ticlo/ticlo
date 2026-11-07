import {describe, expect, it, vi} from 'vitest';
import type {Root} from '@ticlo/core';
import type {DockLayout, TabData} from 'rc-dock';
import {reloadDiscardedFileFlow, unloadDeletedFileFlows} from './file-flow-lifecycle.ts';

describe('file flow lifecycle', () => {
  it('unloads a deleted flow and closes its editor and designer tabs', async () => {
    const unloadFlow = vi.fn(async () => {});
    const root = {unloadFlow} as unknown as Root;
    const tabs = new Map([
      ['blockEditor:+demo.jobs.run', {id: 'blockEditor:+demo.jobs.run'}],
      ['designer:+demo.jobs.run', {id: 'designer:+demo.jobs.run'}],
      ['designer:+demo.other', {id: 'designer:+demo.other'}],
    ]);
    const dockMove = vi.fn((tab: TabData) => tabs.delete(tab.id));
    const layout = {find: (id: string) => tabs.get(id), dockMove} as unknown as DockLayout;

    await unloadDeletedFileFlows(root, layout, 'demo', ['demo/jobs/run.ticlo']);

    expect(unloadFlow).toHaveBeenCalledWith(
      {namespace: 'demo', kind: 'flow', name: 'jobs.run'},
      {discardChanges: true}
    );
    expect(dockMove).toHaveBeenCalledTimes(2);
    expect([...tabs.keys()]).toEqual(['designer:+demo.other']);
  });

  it('reloads a loaded flow after its stored changes are discarded', async () => {
    const unloadFlow = vi.fn(async () => {});
    const loadFlow = vi.fn(async () => {});
    const getFlowState = vi.fn(() => 'enabled');
    const root = {unloadFlow, loadFlow, getFlowState} as unknown as Root;
    const ref = {namespace: 'demo', kind: 'flow', name: 'jobs.run'};

    await reloadDiscardedFileFlow(root, 'demo', 'demo/jobs/run.ticlo');
    expect(unloadFlow).toHaveBeenCalledWith(ref, {discardChanges: true});
    expect(loadFlow).toHaveBeenCalledWith(ref);
    expect(unloadFlow.mock.invocationCallOrder[0]).toBeLessThan(loadFlow.mock.invocationCallOrder[0]);

    getFlowState.mockReturnValue('unloaded');
    await reloadDiscardedFileFlow(root, 'demo', 'demo/jobs/run.ticlo');
    expect(loadFlow).toHaveBeenCalledTimes(1);
  });
});
