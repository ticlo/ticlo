import {assert} from 'chai';
import {Block} from '../Block';
import {Flow, Root} from '../Flow';
import {PropDispatcher} from '../Dispatcher';
import '../../functions/basic/math/Arithmetic';

describe('Block', function () {
  it('basic', function () {
    let job = new Flow();
    job.setValue('@a', 357);
    job.setBinding('@b', '@a');
    assert.equal(job.getValue('@b'), 357, 'basic binding');

    let block = job.createBlock('obj');
    assert.equal(block instanceof Block, true, 'createBlock');
    assert.equal(block, job.getValue('obj'), 'get child block');
    assert.isNull(job.createBlock('obj'), 'can not create block twice');
    // assert.equal(block.getValue(''), block, 'self property');

    block.setValue('@c', 468);
    job.setBinding('@d', 'obj.@c');
    assert.equal(job.getValue('@d'), 468, 'path binding');

    block.setBinding('@e', '##.@b');
    assert.equal(block.getValue('@e'), 357, 'parent binding');

    block.setBinding('@f', '###.@a');
    assert.equal(block.getValue('@f'), 357, 'job binding');

    job.setBinding('@d', null);
    assert.equal(job.getValue('@d'), null, 'clear binding');
  });

  it('query property', function () {
    let job = new Flow();
    let block1 = job.createBlock('block1');
    let block2 = block1.createBlock('block2');
    block2.setValue('p1', 1);

    assert.isTrue(job.queryProperty('block3.p2', true) == null, 'query on non-exist block');
    assert.equal(job.queryValue('block1.block2.p1'), 1, 'query on existing property');
    assert.isTrue(job.queryProperty('block1.block2.p2') == null, 'query on non-exist property');
    assert.isTrue(job.queryProperty('block1.block2.p3', true) != null, 'query and create property');

    assert.equal(job.queryValue('block1.block2.#'), block2, 'query self');
    assert.equal(job.queryValue('block1.block2.##'), block1, 'query parent');
    assert.equal(job.queryValue('block1.block2.###'), job, 'query job');
  });

  it('destroy binding chain', function () {
    let job = new Flow();
    let block1 = job.createBlock('block1');
    let block1c = block1.createOutputBlock('c');
    let block2 = job.createBlock('block2');
    block2.setBinding('c', '##.block1.c');

    assert.equal(block2.getValue('c'), block1c, 'setup binding chain');

    job.deleteValue('block1');

    assert.equal(block2.getValue('c'), undefined, 'destroy binding chain');
  });

  it('set same value', function () {
    let job = new Flow();
    job.updateValue('a', 1);
    job.setValue('a', 1);
    assert.equal(job.getProperty('a')._saved, 1);
  });

  it('update listener within listener', function () {
    let job = new Flow();
    let listener1 = {
      value: 0,
      onSourceChange(prop: PropDispatcher<any>) {
        // do nothing
      },
      onChange(val: any): void {
        this.value = val;
        if (val > 1) {
          job.createBinding('a', listener2);
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
    let binding1 = job.createBinding('a', listener1);
    job.setValue('a', 17);
    assert.equal(listener2.value, 17, 'listener2 should be bound');
    job.setValue('a', 19);
    assert.equal(listener2.value, 19);
    assert.equal(listener1.value, 17, 'listener1 should be unbound');
  });

  it('misc', function () {
    assert.isNull(Root.instance.save(), 'root can not be saved');

    assert.equal(Root.instance.getValue(''), Root.instance);

    let job = Root.instance.addFlow();

    let subjob = job.createOutputBlock('sub');
    subjob._load({'#is': 'add', '0': 1, '1': 2});
    Root.run();
    assert.equal(job.queryValue('sub.#output'), 3, 'not load src directly in createOutputBloc, load sub job later');

    Root.instance.deleteValue(job._prop._name);
    assert.isTrue(subjob.isDestroyed(), 'delete job with auto assigned name');
  });
});
