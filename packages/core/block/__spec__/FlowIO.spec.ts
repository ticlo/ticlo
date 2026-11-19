import {afterEach, describe, expect, it} from 'vitest';
import {
  Block,
  BlockOrder,
  Flow,
  FlowInputsBlock,
  FlowOutputsBlock,
  InputsBlock,
  OutputsBlock,
  Root,
} from '../../index.ts';
import {WorkerFlow} from '../../worker/WorkerFlow.ts';

describe('FlowInputsBlock and FlowOutputsBlock', () => {
  const flows: Flow[] = [];
  afterEach(() => {
    for (const flow of flows.reverse()) flow.destroy();
    flows.length = 0;
  });

  function createFlow(data?: Record<string, unknown>, library = '+libA') {
    const flow = new Flow();
    flows.push(flow);
    flow.load(data ?? {'#is': ''}, null, undefined, undefined, library);
    return flow;
  }

  it('uses FlowInputsBlock/FlowOutputsBlock on ordinary Flow and InputsBlock/OutputsBlock on WorkerFlow', () => {
    const ordinary = createFlow({
      '#is': '',
      '#inputs': {'#is': ''},
      '#outputs': {'#is': '', '#wait': true},
    });
    expect(ordinary.getValue('#inputs')).toBeInstanceOf(FlowInputsBlock);
    expect(ordinary.getValue('#outputs')).toBeInstanceOf(FlowOutputsBlock);
    // Ordinary flows do not forward #outputs.#wait to parent flow.
    expect(ordinary._waiting).toBe(false);

    const worker = new WorkerFlow();
    flows.push(worker);
    worker.load({
      '#is': '',
      '#inputs': {'#is': ''},
      '#outputs': {'#is': '', '#wait': true},
    });
    expect(worker.getValue('#inputs')).toBeInstanceOf(InputsBlock);
    expect(worker.getValue('#inputs')).not.toBeInstanceOf(FlowInputsBlock);
    expect(worker.getValue('#outputs')).toBeInstanceOf(OutputsBlock);
    expect(worker.getValue('#outputs')).not.toBeInstanceOf(FlowOutputsBlock);
    expect(worker._waiting).toBe(true);
  });

  it('preserves saved defaults, supports last-writer-wins across multiple hosts, and reverts cleanly', () => {
    const sub = createFlow({
      '#is': '',
      '#inputs': {
        '#is': '',
        '#custom': [
          {name: 'title', type: 'string'},
          {name: 'count', type: 'number'},
          {name: 'bound', type: 'string'},
        ],
        'title': 'Default Title',
        '~bound': '##.fallback',
      },
      'fallback': 'Fallback Bound',
    });
    sub.startHistory();
    const inputs = sub.getValue('#inputs') as FlowInputsBlock;

    const hostFlow = createFlow({'#is': '', 'source': 'From Binding'});
    const host1 = hostFlow.createBlock('h1');
    const host2 = hostFlow.createBlock('h2');

    // Unset properties on host1 do not clobber saved defaults.
    inputs.attachInputHost(host1);
    expect(inputs.getValue('title')).toBe('Default Title');
    expect(inputs.getValue('count')).toBeUndefined();
    expect(inputs.getValue('bound')).toBe('Fallback Bound');
    expect(sub.getValue('@has-change')).toBeUndefined();

    // host2 provides title and overrides saved default at runtime only.
    host2.setValue('title', 'From H2');
    inputs.attachInputHost(host2);
    expect(inputs.getValue('title')).toBe('From H2');
    expect(sub.getValue('@has-change')).toBeUndefined();
    expect((sub.save()['#inputs'] as Record<string, unknown>).title).toBe('Default Title');

    // host1 updates later -> last-writer-wins.
    host1.setValue('title', 'From H1');
    expect(inputs.getValue('title')).toBe('From H1');

    // Bound input propagates value and reverts to #inputs internal binding when source clears or unbinds.
    host1.setBinding('bound', '##.source');
    expect(inputs.getValue('bound')).toBe('From Binding');
    hostFlow.setValue('source', undefined);
    expect(inputs.getValue('bound')).toBe('Fallback Bound');
    hostFlow.setValue('source', 'Back Again');
    expect(inputs.getValue('bound')).toBe('Back Again');
    host1.setBinding('bound', null);
    expect(inputs.getValue('bound')).toBe('Fallback Bound');

    // Detaching host1 falls back to host2; detaching host2 reverts to saved default.
    inputs.detachInputHost(host1);
    expect(inputs.getValue('title')).toBe('From H2');
    inputs.detachInputHost(host2);
    expect(inputs.getValue('title')).toBe('Default Title');
  });

  it('handles refcounted attach/detach, #order wrapping, file-path conversion, reserved keys, and #custom edits', () => {
    const sub = createFlow(
      {
        '#is': '',
        '#inputs': {
          '#is': '',
          '#custom': [
            {name: '#order', type: 'array'},
            {name: 'file', type: 'string'},
            {name: 'src', type: 'string'},
            {name: '#maxInstance', type: 'number'},
          ],
          'src': 'KeepOwnSrc',
        },
      },
      '+projSub'
    );
    const inputs = sub.getValue('#inputs') as FlowInputsBlock;
    const hostFlow = createFlow({'#is': ''}, '+projHost');
    const host = hostFlow.createBlock('host');
    host.setValue('#order', ['a', 'b']);
    host.setValue('file', '+/img.png');
    host.setValue('src', '+/other.ticlo');
    host.setValue('#maxInstance', 99);

    const reserved = new Set(['src']);
    inputs.attachInputHost(host, reserved);
    // Second refcount does not duplicate watcher or drop on first detach.
    inputs.attachInputHost(host, reserved);

    const order = inputs.getValue('#order') as BlockOrder;
    expect(order).toBeInstanceOf(BlockOrder);
    expect(order.owner).toBe(host);
    expect(order.order).toEqual(['a', 'b']);
    expect(inputs.getValue('file')).toBe('+/img.png');
    // Reserved & blocked config keys are never forwarded.
    expect(inputs.getValue('src')).toBe('KeepOwnSrc');
    expect(inputs.getValue('#maxInstance')).toBeUndefined();

    // Updating #custom type to file-path converts cross-library relative path, and adding a new input picks up host value.
    host.setValue('extra', 42);
    inputs.setValue('#custom', [
      {name: '#order', type: 'array'},
      {name: 'file', type: 'file-path'},
      {name: 'extra', type: 'number'},
    ]);
    expect(inputs.getValue('file')).toBe('+projHost/img.png');
    expect(inputs.getValue('extra')).toBe(42);

    // Removing #order from #custom reverts it.
    inputs.setValue('#custom', [
      {name: 'file', type: 'file-path'},
      {name: 'extra', type: 'number'},
    ]);
    expect(inputs.getValue('#order')).toBeUndefined();

    // First detach keeps host active because refcount was 2.
    inputs.detachInputHost(host);
    expect(inputs.getValue('file')).toBe('+projHost/img.png');

    // Second detach clears host values.
    inputs.detachInputHost(host);
    expect(inputs.getValue('file')).toBeUndefined();
    expect(inputs.getValue('extra')).toBeUndefined();
  });

  it('fans out #outputs to multiple targets and cleans up each target independently', () => {
    const sub = createFlow({
      '#is': '',
      '#outputs': {
        '#is': '',
        '#custom': [
          {name: 'label', type: 'string'},
          {name: '#output', type: 'number'},
        ],
        'label': 'Initial',
        '#output': 10,
        '#return': 'ignoredReturn',
        'src': 'ignoredReserved',
      },
    });
    const outputs = sub.getValue('#outputs') as FlowOutputsBlock;

    const hostFlow = createFlow();
    const target1 = hostFlow.createBlock('t1');
    const target2 = hostFlow.createBlock('t2');
    const reserved = new Set(['src']);

    target1.setValue('src', 'keep-src');
    outputs.attachOutputTarget(target1, reserved);
    outputs.attachOutputTarget(target2, reserved);

    // Immediate initial sync on attach, excluding #return and reserved keys.
    expect(target1.getValue('label')).toBe('Initial');
    expect(target1.getValue('#output')).toBe(10);
    expect(target1.getValue('#return')).toBeUndefined();
    expect(target1.getValue('src')).toBe('keep-src');
    expect(target2.getValue('label')).toBe('Initial');
    expect(target2.getValue('#output')).toBe(10);

    // Live updates propagate to both targets.
    outputs.setValue('label', 'Updated');
    outputs.setValue('#output', 25);
    expect(target1.getValue('label')).toBe('Updated');
    expect(target1.getValue('#output')).toBe(25);
    expect(target2.getValue('label')).toBe('Updated');
    expect(target2.getValue('#output')).toBe(25);

    // Detaching target1 clears only target1's written outputs without affecting target2.
    outputs.detachOutputTarget(target1);
    expect(target1.getValue('label')).toBeUndefined();
    expect(target1.getValue('#output')).toBeUndefined();
    expect(target1.getValue('src')).toBe('keep-src');
    expect(target2.getValue('label')).toBe('Updated');
    expect(target2.getValue('#output')).toBe(25);

    // Destroying #outputs clears remaining targets.
    sub.deleteValue('#outputs');
    Root.run();
    expect(target2.getValue('label')).toBeUndefined();
    expect(target2.getValue('#output')).toBeUndefined();
  });

  it('prevents feedback loop when the same host attaches to both #inputs and #outputs', () => {
    const sub = createFlow({
      '#is': '',
      '#inputs': {'#is': '', '#custom': [{name: 'shared', type: 'number'}]},
      '#outputs': {'#is': '', '#custom': [{name: 'shared', type: 'number'}]},
    });
    const inputs = sub.getValue('#inputs') as FlowInputsBlock;
    const outputs = sub.getValue('#outputs') as FlowOutputsBlock;
    const hostFlow = createFlow();
    const host = hostFlow.createBlock('host');

    inputs.attachInputHost(host);
    outputs.attachOutputTarget(host);
    // Output from sub writes to host via output() (_outputing = true) and must not feed back into sub.#inputs.
    outputs.setValue('shared', 99);
    expect(host.getValue('shared')).toBe(99);
    expect(inputs.getValue('shared')).toBeUndefined();

    outputs.detachOutputTarget(host);
    inputs.detachInputHost(host);
  });
});
