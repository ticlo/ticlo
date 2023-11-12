import expect from 'expect';
import '../Arithmetic';
import {Block} from '../../../block/Block';
import {Flow, Root} from '../../../block/Flow';

describe('Math', function () {
  it('basic add', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'add');
    aBlock.setValue('0', 2);
    aBlock.setValue('1', 3);

    Root.run();

    expect(aBlock.getValue('#output')).toEqual(5);

    aBlock.setValue('0', 4);

    Root.run();
    expect(aBlock.getValue('#output')).toEqual(7);

    aBlock = flow.createBlock('a2');

    // set class last
    aBlock.setValue('0', 2.5);
    aBlock.setValue('1', 3.5);
    aBlock.setValue('#is', 'add');

    Root.run();
    expect(aBlock.getValue('#output')).toEqual(6);

    // save load
    let saved = flow.save();
    let flow2 = new Flow();
    flow2.load(saved);

    let aBlock2 = flow2.getValue('a2');
    expect(aBlock2).toBeInstanceOf(Block);
    Root.run();
    expect(aBlock2.getValue('#output')).toEqual(6);
  });

  it('add multiple', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    aBlock._load({'#is': 'add', '0': 2, '1': 3, '2': 4, '[]': 3});

    Root.run();
    expect(aBlock.getValue('#output')).toEqual(9);

    aBlock.setValue('3', 5);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(9);

    aBlock.setValue('[]', 4);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(14);

    aBlock.setValue('[]', 2);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(5);

    aBlock.setValue('[]', 0);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(0);
  });

  it('add array', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    aBlock._load({'#is': 'add', '[]': [1, 2]});

    Root.run();
    expect(aBlock.getValue('#output')).toEqual(3);
  });

  it('subtract', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'subtract');
    aBlock.setValue('0', 7);
    aBlock.setValue('1', 3);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(4);

    aBlock.setValue('1', null);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(undefined);
  });

  it('divide', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'divide');
    aBlock.setValue('0', 7);
    aBlock.setValue('1', 2);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(3.5);

    aBlock.setValue('1', null);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(undefined);
  });

  it('multiply', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'multiply');
    aBlock.setValue('0', 2);
    aBlock.setValue('1', 3);
    aBlock.setValue('2', 5);
    aBlock.setValue('[]', 3);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(30);

    aBlock.setValue('2', null);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(undefined);

    aBlock.setValue('[]', -1);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(6);

    aBlock.setValue('[]', 0);
    Root.run();
    expect(aBlock.getValue('#output')).toEqual(1);
  });
});
