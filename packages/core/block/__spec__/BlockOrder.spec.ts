import {afterEach, describe, expect, it} from 'vitest';
import {Block, InputsBlock} from '../Block.ts';
import {Flow} from '../Flow.ts';
import {BlockOrder} from '../BlockOrder.ts';
import {decode, encode, encodeSorted} from '../../util/Serialize.ts';
import {NoSerialize} from '../../util/NoSerialize.ts';

describe('forwarded #order', () => {
  const flows: Flow[] = [];
  afterEach(() => {
    for (const flow of flows.reverse()) flow.destroy();
    flows.length = 0;
  });

  function worker() {
    const flow = new Flow();
    flows.push(flow);
    flow.load({
      '#inputs': {'#is': '', '#custom': [{name: '#order', type: 'array'}]},
      'layout': {'#is': '', '~#order': '##.#inputs.#order'},
    });
    return flow;
  }

  it('retains the original owner and propagates order updates through nested inputs', () => {
    const owner = worker();
    owner.setValue('#order', ['a']);
    const first = worker();
    first.updateInput(owner);
    const layout = first.getValue('layout') as Block;
    const second = worker();
    second.updateInput(layout);
    const order = layout.getValue('#order') as BlockOrder;
    expect(order).toBeInstanceOf(BlockOrder);
    expect(order.owner).toBe(owner);
    expect(order.order).toEqual(['a']);
    expect(second.queryValue('#inputs.#order')).toBe(order);

    owner.setValue('#order', ['b', 'a']);
    const updated = layout.getValue('#order') as BlockOrder;
    expect(updated.owner).toBe(owner);
    expect(updated.order).toEqual(['b', 'a']);
    expect(second.queryValue('#inputs.#order')).toBe(updated);
    expect(first.save()['#inputs']).not.toHaveProperty('#order');
    owner.setValue('#order', undefined);
    expect(second.queryValue('#inputs.#order')).toBeUndefined();
  });

  it('wraps object inputs and resolves children on that object', () => {
    const flow = worker();
    const child = flow.createBlock('child');
    const previous = worker();
    previous.setValue('#order', ['previous']);
    flow.updateInput(previous);
    const input = {'#order': ['child'], child};
    flow.updateInput(input);
    previous.setValue('#order', ['changed']);
    const order = flow.queryValue('#inputs.#order') as BlockOrder;
    expect(order.owner).toBe(input);
    expect(order.order).toBe(input['#order']);
    expect(order.getValue('child')).toBe(child);
    const invalid = {'#order': ['child', 42]};
    flow.updateInput(invalid);
    expect(flow.queryValue('#inputs.#order')).toBe(invalid['#order']);
    flow.updateInput(previous);
    previous.setValue('#order', ['returned']);
    expect((flow.queryValue('#inputs.#order') as BlockOrder).owner).toBe(previous);
    expect((flow.queryValue('#inputs.#order') as BlockOrder).order).toEqual(['returned']);
  });

  it('leaves locally defined arrays unchanged and keeps owner references off the wire', () => {
    const flow = worker();
    const inputs = flow.getValue('#inputs') as InputsBlock;
    inputs.setValue('#order', ['local']);
    expect(inputs.getValue('#order')).toEqual(['local']);
    const order = new BlockOrder(flow, ['child']);
    expect(decode(encode(order))).toBeInstanceOf(NoSerialize);
    expect(decode(encodeSorted(order))).toBeInstanceOf(NoSerialize);
  });
});
