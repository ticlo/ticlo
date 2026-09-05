import {encode, Root} from '@ticlo/core';
import {FlowState} from '@ticlo/core/block/Flow.js';
import {FlowTestCase} from '@ticlo/test';
import {describe, expect, it, vi} from 'vitest';
import {TestLoader} from '../TestLoader.js';

describe('TestLoader', () => {
  it('reuses the task for the same test path', () => {
    const loader = new TestLoader(['packages/core']);
    const name = 'tests.core.functions.math.arithmetic';

    expect(loader.getTask(name)).toBe(loader.getTask(name));
  });

  it('reloads an on-demand test after disabling and enabling it', async () => {
    const loader = new TestLoader([], {onDemandLoad: true});
    const read = vi
      .fn()
      .mockResolvedValueOnce(
        encode({'#is': 'flow:test-case', '#disabled': true, 'first': 1, 'assert1': {'#is': 'test:assert'}})
      )
      .mockResolvedValueOnce(
        encode({'#is': 'flow:test-case', '#disabled': true, 'second': 2, 'assert2': {'#is': 'test:assert'}})
      );
    vi.spyOn(loader, 'getTask').mockReturnValue({path: 'test.ticlo', read} as any);

    const root = new Root();
    const property = root.getProperty('case');
    const flow = new FlowTestCase(root, property, 0);
    const states: FlowState[] = [];
    let pending: Promise<void>;
    flow.updateValue('#disabled', true);
    flow.load({}, null, undefined, (changedFlow, state) => {
      states.push(state);
      pending = loader.flowStateChanged(changedFlow, 'tests.core.case', state);
    });
    property.setValue(flow);

    flow.updateValue('#disabled', undefined);
    await pending;
    expect(flow.getValue('first')).toBe(1);
    expect(flow.results.size).toBe(1);
    expect(flow._disabled).toBe(false);
    expect(flow.getValue('#disabled')).toBeUndefined();
    expect(flow.getProperty('#disabled')._saved).toBe(true);

    flow.updateValue('#disabled', true);
    await pending;
    expect(flow.getValue('#disabled')).toBe(true);
    expect(flow.getValue('first')).toBeUndefined();

    flow.updateValue('#disabled', undefined);
    await pending;
    expect(flow.getValue('second')).toBe(2);
    expect(flow.getValue('first')).toBeUndefined();
    expect(flow.results.size).toBe(1);
    expect(read).toHaveBeenCalledTimes(2);
    expect(states).toEqual([FlowState.enabled, FlowState.disabled, FlowState.enabled]);

    flow._onStateChange = undefined;
    root.destroy();
  });

  it('ignores an enabled read that completes after the test is disabled', async () => {
    const loader = new TestLoader([], {onDemandLoad: true});
    let resolveRead: (data: string) => void;
    const read = vi.fn(() => new Promise<string>((resolve) => (resolveRead = resolve)));
    vi.spyOn(loader, 'getTask').mockReturnValue({path: 'test.ticlo', read} as any);

    const root = new Root();
    const property = root.getProperty('case');
    const flow = new FlowTestCase(root, property, 0);
    const pending: Promise<void>[] = [];
    flow.updateValue('#disabled', true);
    flow.load({}, null, undefined, (changedFlow, state) => {
      pending.push(loader.flowStateChanged(changedFlow, 'tests.core.case', state));
    });
    property.setValue(flow);

    flow.updateValue('#disabled', undefined);
    expect(read).toHaveBeenCalledOnce();
    flow.updateValue('#disabled', true);
    await pending[1];

    resolveRead!(encode({stale: 1}));
    await pending[0];
    expect(flow._disabled).toBe(true);
    expect(flow.getValue('#disabled')).toBe(true);
    expect(flow.getValue('stale')).toBeUndefined();

    flow._onStateChange = undefined;
    root.destroy();
  });

  it('ignores an enabled read that completes after the test is detached', async () => {
    const loader = new TestLoader([], {onDemandLoad: true});
    let resolveRead: (data: string) => void;
    const read = vi.fn(() => new Promise<string>((resolve) => (resolveRead = resolve)));
    vi.spyOn(loader, 'getTask').mockReturnValue({path: 'test.ticlo', read} as any);

    const root = new Root();
    const property = root.getProperty('case');
    const flow = new FlowTestCase(root, property, 0);
    let pending: Promise<void>;
    flow.updateValue('#disabled', true);
    flow.load({}, null, undefined, (changedFlow, state) => {
      pending = loader.flowStateChanged(changedFlow, 'tests.core.case', state);
    });
    property.setValue(flow);

    flow.updateValue('#disabled', undefined);
    expect(read).toHaveBeenCalledOnce();
    property.setValue(undefined);

    resolveRead!(encode({stale: 1}));
    await pending!;
    expect(flow.getValue('stale')).toBeUndefined();

    flow._onStateChange = undefined;
    root.destroy();
  });
});
