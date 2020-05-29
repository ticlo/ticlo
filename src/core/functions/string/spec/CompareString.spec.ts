import {assert} from 'chai';
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

    assert.equal(aBlock.getValue('#output'), true);

    aBlock.setValue('input', 'aabc');
    Root.run();
    assert.equal(aBlock.getValue('#output'), false);

    // array input
    aBlock.setValue('input', ['ab', 'c']);
    Root.run();
    assert.equal(aBlock.getValue('#output'), true);

    aBlock.setValue('input', []);
    Root.run();
    assert.equal(aBlock.getValue('#output'), false);

    // invalid input
    aBlock.setValue('input', 'a');
    aBlock.setValue('search', null);
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);

    // invalid input
    aBlock.setValue('input', 0);
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);
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

    assert.equal(aBlock.getValue('#output'), true);

    aBlock.setValue('input', 'abcc');
    Root.run();
    assert.equal(aBlock.getValue('#output'), false);

    // array input
    aBlock.setValue('input', ['a', 'bc']);
    Root.run();
    assert.equal(aBlock.getValue('#output'), true);

    aBlock.setValue('input', []);
    Root.run();
    assert.equal(aBlock.getValue('#output'), false);

    // invalid input
    aBlock.setValue('input', 'a');
    aBlock.setValue('search', {});
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);

    // invalid input
    aBlock.setValue('input', false);
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);
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

    assert.equal(aBlock.getValue('#output'), true);

    aBlock.setValue('search', 'd');
    Root.run();
    assert.equal(aBlock.getValue('#output'), false);

    // array input
    aBlock.setValue('input', ['a', 'd', 'g']);
    Root.run();
    assert.equal(aBlock.getValue('#output'), true);

    aBlock.setValue('input', []);
    Root.run();
    assert.equal(aBlock.getValue('#output'), false);

    // invalid input
    aBlock.setValue('input', 'a');
    aBlock.setValue('search', {});
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);

    // invalid input
    aBlock.setValue('input', false);
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);
  });
});
