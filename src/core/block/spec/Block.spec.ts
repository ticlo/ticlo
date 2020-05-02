import {assert} from 'chai';
import {Block} from '../Block';
import {Flow, Root} from '../Flow';
import {PropDispatcher} from '../Dispatcher';
import '../../functions/basic/math/Arithmetic';

describe('Block', function () {
  it('basic', function () {
    let flow = new Flow();
    flow.setValue('@a', 357);
    flow.setBinding('@b', '@a');
    assert.equal(flow.getValue('@b'), 357, 'basic binding');

    let block = flow.createBlock('obj');
    assert.equal(block instanceof Block, true, 'createBlock');
    assert.equal(block, flow.getValue('obj'), 'get child block');
    assert.isNull(flow.createBlock('obj'), 'can not create block twice');
    // assert.equal(block.getValue(''), block, 'self property');

    block.setValue('@c', 468);
    flow.setBinding('@d', 'obj.@c');
    assert.equal(flow.getValue('@d'), 468, 'path binding');

    block.setBinding('@e', '##.@b');
    assert.equal(block.getValue('@e'), 357, 'parent binding');

    block.setBinding('@f', '###.@a');
    assert.equal(block.getValue('@f'), 357, 'flow binding');

    flow.setBinding('@d', null);
    assert.equal(flow.getValue('@d'), null, 'clear binding');
  });

  it('query property', function () {
    let flow = new Flow();
    let block1 = flow.createBlock('block1');
    let block2 = block1.createBlock('block2');
    block2.setValue('p1', 1);

    assert.isTrue(flow.queryProperty('block3.p2', true) == null, 'query on non-exist block');
    assert.equal(flow.queryValue('block1.block2.p1'), 1, 'query on existing property');
    assert.isTrue(flow.queryProperty('block1.block2.p2') == null, 'query on non-exist property');
    assert.isTrue(flow.queryProperty('block1.block2.p3', true) != null, 'query and create property');

    assert.equal(flow.queryValue('block1.block2.#'), block2, 'query self');
    assert.equal(flow.queryValue('block1.block2.##'), block1, 'query parent');
    assert.equal(flow.queryValue('block1.block2.###'), flow, 'query flow');
  });

  it('destroy binding chain', function () {
    let flow = new Flow();
    let block1 = flow.createBlock('block1');
    let block1c = block1.createOutputBlock('c');
    let block2 = flow.createBlock('block2');
    block2.setBinding('c', '##.block1.c');

    assert.equal(block2.getValue('c'), block1c, 'setup binding chain');

    flow.deleteValue('block1');

    assert.equal(block2.getValue('c'), undefined, 'destroy binding chain');
  });

  it('set same value', function () {
    let flow = new Flow();
    flow.updateValue('a', 1);
    flow.setValue('a', 1);
    assert.equal(flow.getProperty('a')._saved, 1);
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
    assert.equal(listener2.value, 17, 'listener2 should be bound');
    flow.setValue('a', 19);
    assert.equal(listener2.value, 19);
    assert.equal(listener1.value, 17, 'listener1 should be unbound');
  });

  it('misc', function () {
    assert.isNull(Root.instance.save(), 'root can not be saved');

    assert.equal(Root.instance.getValue(''), Root.instance);

    let flow = Root.instance.addFlow();

    let subflow = flow.createOutputBlock('sub');
    subflow._load({'#is': 'add', '0': 1, '1': 2});
    Root.run();
    assert.equal(flow.queryValue('sub.#output'), 3, 'not load src directly in createOutputBloc, load sub flow later');

    Root.instance.deleteValue(flow._prop._name);
    assert.isTrue(subflow.isDestroyed(), 'delete flow with auto assigned name');
  });
});
