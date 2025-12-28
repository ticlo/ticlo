import {expect} from 'vitest';
import '../Arithmetic.js';
import {Block} from '../../../block/Block.js';
import {Flow, Root} from '../../../block/Flow.js';

describe('Math', function () {
  it('basic add', function () {
    const flow = new Flow();

    let aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'add');
    aBlock.setValue('0', 2);
    aBlock.setValue('1', 3);

    Root.run();

    expect(aBlock.getValue('#output')).toBe(5);

    aBlock.setValue('0', 4);

    Root.run();
    expect(aBlock.getValue('#output')).toBe(7);

    aBlock = flow.createBlock('a2');

    // set class last
    aBlock.setValue('0', 2.5);
    aBlock.setValue('1', 3.5);
    aBlock.setValue('#is', 'add');

    Root.run();
    expect(aBlock.getValue('#output')).toBe(6);

    // save load
    const saved = flow.save();
    const flow2 = new Flow();
    flow2.load(saved);

    const aBlock2 = flow2.getValue('a2') as Block;
    expect(aBlock2).toBeInstanceOf(Block);
    Root.run();
    expect(aBlock2.getValue('#output')).toBe(6);
  });

  it('add multiple', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock._load({'#is': 'add', '0': 2, '1': 3, '2': 4, '[]': 3});

    Root.run();
    expect(aBlock.getValue('#output')).toBe(9);

    aBlock.setValue('3', 5);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(9);

    aBlock.setValue('[]', 4);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(14);

    aBlock.setValue('[]', 2);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(5);

    aBlock.setValue('[]', 0);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(0);
  });

  it('add array', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock._load({'#is': 'add', '[]': [1, 2]});

    Root.run();
    expect(aBlock.getValue('#output')).toBe(3);
  });

  it('subtract', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'subtract');
    aBlock.setValue('0', 7);
    aBlock.setValue('1', 3);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(4);

    aBlock.setValue('1', null);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);
  });

  it('divide', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'divide');
    aBlock.setValue('0', 7);
    aBlock.setValue('1', 2);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(3.5);

    aBlock.setValue('1', null);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);
  });

  it('multiply', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'multiply');
    aBlock.setValue('0', 2);
    aBlock.setValue('1', 3);
    aBlock.setValue('2', 5);
    aBlock.setValue('[]', 3);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(30);

    aBlock.setValue('2', null);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);

    aBlock.setValue('[]', -1);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(6);

    aBlock.setValue('[]', 0);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(1);
  });
});
