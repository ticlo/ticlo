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

  it('modulo and power', function () {
    const flow = new Flow();

    const modulo = flow.createBlock('modulo');
    modulo._load({'#is': 'modulo', '0': 7, '1': 3});
    const power = flow.createBlock('power');
    power._load({'#is': 'power', '0': 2, '1': 4});

    Root.run();
    expect(modulo.getValue('#output')).toBe(1);
    expect(power.getValue('#output')).toBe(16);

    modulo.setValue('1', null);
    power.setValue('0', null);
    Root.run();
    expect(modulo.getValue('#output')).toBe(undefined);
    expect(power.getValue('#output')).toBe(undefined);
  });

  it('round floor ceil and abs', function () {
    const flow = new Flow();

    const round = flow.createBlock('round');
    round._load({'#is': 'round', 'input': 2.5});
    const floor = flow.createBlock('floor');
    floor._load({'#is': 'floor', 'input': 2.9});
    const ceil = flow.createBlock('ceil');
    ceil._load({'#is': 'ceil', 'input': 2.1});
    const abs = flow.createBlock('abs');
    abs._load({'#is': 'abs', 'input': -3});

    Root.run();
    expect(round.getValue('#output')).toBe(3);
    expect(floor.getValue('#output')).toBe(2);
    expect(ceil.getValue('#output')).toBe(3);
    expect(abs.getValue('#output')).toBe(3);

    abs.setValue('input', null);
    Root.run();
    expect(abs.getValue('#output')).toBe(undefined);
  });

  it('clamp', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock._load({'#is': 'clamp', 'input': 7, 'min': 2, 'max': 5});
    Root.run();
    expect(aBlock.getValue('#output')).toBe(5);

    aBlock.setValue('input', 1);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(2);

    aBlock.setValue('input', 3);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(3);

    aBlock.setValue('max', null);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);
  });

  it('min and max multiple inputs', function () {
    const flow = new Flow();

    const min = flow.createBlock('min');
    min._load({'#is': 'min', '0': 7, '1': 3, '2': 5, '[]': 3});
    const max = flow.createBlock('max');
    max._load({'#is': 'max', '0': 7, '1': 3, '2': 5, '[]': 3});

    Root.run();
    expect(min.getValue('#output')).toBe(3);
    expect(max.getValue('#output')).toBe(7);

    min.setValue('[]', [4, 9, 2]);
    max.setValue('[]', [4, 9, 2]);
    Root.run();
    expect(min.getValue('#output')).toBe(2);
    expect(max.getValue('#output')).toBe(9);

    min.setValue('[]', 0);
    max.setValue('[]', 0);
    Root.run();
    expect(min.getValue('#output')).toBe(undefined);
    expect(max.getValue('#output')).toBe(undefined);
  });
});
