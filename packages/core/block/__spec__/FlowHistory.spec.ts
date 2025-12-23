import {expect} from 'vitest';
import {Flow} from '../Flow.js';
import {FlowHistory} from '../FlowHistory.js';
import {shouldHappen} from '../../util/test-util.js';
import {WorkerFlow} from '../../worker/WorkerFlow.js';

describe('FlowHistory', function () {
  it('undo redo', function () {
    let flow = new Flow();
    flow.setValue('a', 1);
    flow.startHistory();
    let history = flow._history;

    history.undo();
    expect(flow.getValue('@has-undo')).not.toBeDefined();
    expect(flow.getValue('@has-redo')).not.toBeDefined();

    flow.setValue('a', 2);
    history.add(flow.save());

    expect(flow.getValue('@has-undo')).toBe(true);
    expect(flow.getValue('@has-redo')).not.toBeDefined();

    history.undo();
    expect(flow.getValue('a')).toBe(1);

    expect(flow.getValue('@has-undo')).not.toBeDefined();
    expect(flow.getValue('@has-redo')).toBe(true);

    flow.setValue('a', 3);
    history.add(flow.save());

    expect(flow.getValue('@has-undo')).toBe(true);
    expect(flow.getValue('@has-redo')).not.toBeDefined();

    history.undo();
    history.redo();
    expect(flow.getValue('a')).toBe(3);

    flow.destroyHistory();
    expect(flow.getValue('@has-undo')).not.toBeDefined();
    expect(flow.getValue('@has-redo')).not.toBeDefined();
    expect(flow._history).toBeNull();

    flow.destroy();
  });

  it('trackChange', async function () {
    let debounceInterval = FlowHistory._debounceInterval;
    FlowHistory._debounceInterval = 50;

    let flow = new WorkerFlow();
    flow.load({a: 1}, null, (data) => true);
    flow.startHistory();
    let history = flow._history;
    flow.setValue('a', 2);

    flow.trackChange();
    expect(history._tracking).toBe(true);
    expect(flow.getValue('@has-change')).toBe(true);

    flow.undo();
    expect(history._tracking).toBe(false);
    expect(flow.getValue('a')).toBe(1);
    expect(flow.getValue('@has-change')).not.toBeDefined();

    flow.setValue('a', 3);
    flow.trackChange();
    flow.redo(); // shouldn't do anything
    expect(history._tracking).toBe(true);

    flow.setValue('a', 4);
    flow.trackChange();

    await shouldHappen(() => history._tracking === false, 500);

    flow.applyChange();
    expect(flow.getValue('@has-change')).not.toBeDefined();

    flow.undo();
    expect(flow.getValue('a')).toBe(1);
    expect(flow.getValue('@has-change')).toBe(true);

    flow.setValue('a', 3);

    // destroy history
    flow.unwatch({onChildChange: () => {}});
    // reload from saved state
    expect(flow.getValue('a')).toBe(1);

    flow.destroy();
    FlowHistory._debounceInterval = debounceInterval;
  });
});
