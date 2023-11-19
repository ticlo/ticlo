import expect from 'expect';
import '../CompareString';
import {Block} from '../../../block/Block';
import {Flow, Root} from '../../../block/Flow';

describe('CompareString', function () {
  it('start with', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'start-with',
      'input': 'abc',
      'search': 'ab',
    });

    Root.run();

    expect(aBlock.getValue('#output')).toBe(true);

    aBlock.setValue('input', 'aabc');
    Root.run();
    expect(aBlock.getValue('#output')).toBe(false);

    // array input
    aBlock.setValue('input', ['ab', 'c']);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(true);

    aBlock.setValue('input', []);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(false);

    // invalid input
    aBlock.setValue('input', 'a');
    aBlock.setValue('search', null);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);

    // invalid input
    aBlock.setValue('input', 0);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);
  });

  it('end with', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'end-with',
      'input': 'abc',
      'search': 'bc',
    });

    Root.run();

    expect(aBlock.getValue('#output')).toBe(true);

    aBlock.setValue('input', 'abcc');
    Root.run();
    expect(aBlock.getValue('#output')).toBe(false);

    // array input
    aBlock.setValue('input', ['a', 'bc']);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(true);

    aBlock.setValue('input', []);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(false);

    // invalid input
    aBlock.setValue('input', 'a');
    aBlock.setValue('search', {});
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);

    // invalid input
    aBlock.setValue('input', false);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);
  });

  it('contain', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'contain',
      'input': 'abc',
      'search': 'b',
    });

    Root.run();

    expect(aBlock.getValue('#output')).toBe(true);

    aBlock.setValue('search', 'd');
    Root.run();
    expect(aBlock.getValue('#output')).toBe(false);

    // array input
    aBlock.setValue('input', ['a', 'd', 'g']);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(true);

    aBlock.setValue('input', []);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(false);

    // invalid input
    aBlock.setValue('input', 'a');
    aBlock.setValue('search', {});
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);

    // invalid input
    aBlock.setValue('input', false);
    Root.run();
    expect(aBlock.getValue('#output')).toBe(undefined);
  });
});
