import expect from 'expect';
import {Block} from '../Block';
import {Flow, Root} from '../Flow';
import {PropDispatcher} from '../Dispatcher';
import '../../functions/math/Arithmetic';

describe('Block', function () {
  it('basic', function () {
    let flow = new Flow();
    flow.setValue('@a', 357);
    flow.setBinding('@b', '@a');
    expect(flow.getValue('@b')).toBe(357);

    let block = flow.createBlock('obj');
    expect(block instanceof Block).toEqual(true);
    expect(block).toEqual(flow.getValue('obj'));
    expect(flow.createBlock('obj')).toBeNull();
    // assert.equal(block.getValue(''), block, 'self property');

    block.setValue('@c', 468);
    flow.setBinding('@d', 'obj.@c');
    expect(flow.getValue('@d')).toBe(468);

    block.setBinding('@e', '##.@b');
    expect(block.getValue('@e')).toBe(357);

    block.setBinding('@f', '###.@a');
    expect(block.getValue('@f')).toBe(357);

    flow.setBinding('@d', null);
    expect(flow.getValue('@d')).toBeUndefined();
  });

  it('query property', function () {
    let flow = new Flow();
    let block1 = flow.createBlock('block1');
    let block2 = block1.createBlock('block2');
    block2.setValue('p1', 1);

    expect(flow.queryProperty('block3.p2', true) == null).toBe(true);
    expect(flow.queryValue('block1.block2.p1')).toBe(1);
    expect(flow.queryProperty('block1.block2.p2') == null).toBe(true);
    expect(flow.queryProperty('block1.block2.p3', true) != null).toBe(true);

    expect(flow.queryValue('block1.block2.#')).toEqual(block2);
    expect(flow.queryValue('block1.block2.##')).toEqual(block1);
    expect(flow.queryValue('block1.block2.###')).toEqual(flow);
  });

  it('destroy binding chain', function () {
    let flow = new Flow();
    let block1 = flow.createBlock('block1');
    let block1c = block1.createOutputBlock('c');
    let block2 = flow.createBlock('block2');
    block2.setBinding('c', '##.block1.c');

    expect(block2.getValue('c')).toEqual(block1c);

    flow.deleteValue('block1');

    expect(block2.getValue('c')).toEqual(undefined);
  });

  it('set same value', function () {
    let flow = new Flow();
    flow.updateValue('a', 1);
    flow.setValue('a', 1);
    expect(flow.getProperty('a')._saved).toBe(1);
  });

  it('update listener within listener', function () {
    let flow = new Flow();
    let listener1 = {
      value: 0,
      onSourceChange(prop: PropDispatcher<any>) {
        // do nothing
      },
      onChange(val: any): void {
        this.value = val;
        if (val > 1) {
          flow.createBinding('a', listener2);
        }
      },
    };
    let listener2 = {
      value: 0,
      onSourceChange(prop: PropDispatcher<any>) {
        // do nothing
      },
      onChange(val: any) {
        this.value = val;
        binding1.unlisten(listener1);
      },
    };
    let binding1 = flow.createBinding('a', listener1);
    flow.setValue('a', 17);
    expect(listener2.value).toBe(17);
    flow.setValue('a', 19);
    expect(listener2.value).toBe(19);
    expect(listener1.value).toBe(17);
  });

  it('misc', function () {
    expect(Root.instance.save()).toBeNull();

    expect(Root.instance.getValue('')).toEqual(Root.instance);

    let flow = Root.instance.addFlow();

    let subflow = flow.createOutputBlock('sub');
    subflow._load({'#is': 'add', '0': 1, '1': 2});
    Root.run();
    expect(flow.queryValue('sub.#output')).toBe(3);

    Root.instance.deleteValue(flow._prop._name);
    expect(subflow.isDestroyed()).toBe(true);
  });
});
