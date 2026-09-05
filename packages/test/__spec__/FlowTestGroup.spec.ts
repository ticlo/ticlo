import {describe, expect, it, vi} from 'vitest';
import {Root} from '@ticlo/core';
import {FlowTestGroup} from '../FlowTestGroup.js';
import {TestState} from '../Interface.js';

describe('FlowTestGroup', () => {
  it('reports running while a child test is still waiting', () => {
    const root = new Root();
    const parent = {updateTestState: vi.fn()};
    const group = new FlowTestGroup(root, root.getProperty('group'), 0, parent);
    group.results.set(root, TestState.RUNNING);

    group.run();

    expect(group.getValue('@b-name')).toContain('running');
    expect(parent.updateTestState).toHaveBeenLastCalledWith(group, TestState.RUNNING);
    group.destroy();
    root.destroy();
  });
});
