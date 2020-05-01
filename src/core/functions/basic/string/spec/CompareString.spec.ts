import {assert} from 'chai';
import '../CompareString';
import {Block} from '../../../../block/Block';
import {Flow, Root} from '../../../../block/Flow';

describe('CompareString', function () {
  it('start with', function () {
    let job = new Flow();

    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'start-with',
      '0': 'abc',
      '1': 'ab',
    });

    Root.run();

    assert.equal(aBlock.getValue('#output'), true);

    aBlock.setValue('0', 'aabc');
    Root.run();
    assert.equal(aBlock.getValue('#output'), false);

    // array input
    aBlock.setValue('0', ['ab', 'c']);
    Root.run();
    assert.equal(aBlock.getValue('#output'), true);

    aBlock.setValue('0', []);
    Root.run();
    assert.equal(aBlock.getValue('#output'), false);

    // invalid input
    aBlock.setValue('0', 'a');
    aBlock.setValue('1', null);
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);

    // invalid input
    aBlock.setValue('0', 0);
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);
  });

  it('end with', function () {
    let job = new Flow();

    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'end-with',
      '0': 'abc',
      '1': 'bc',
    });

    Root.run();

    assert.equal(aBlock.getValue('#output'), true);

    aBlock.setValue('0', 'abcc');
    Root.run();
    assert.equal(aBlock.getValue('#output'), false);

    // array input
    aBlock.setValue('0', ['a', 'bc']);
    Root.run();
    assert.equal(aBlock.getValue('#output'), true);

    aBlock.setValue('0', []);
    Root.run();
    assert.equal(aBlock.getValue('#output'), false);

    // invalid input
    aBlock.setValue('0', 'a');
    aBlock.setValue('1', {});
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);

    // invalid input
    aBlock.setValue('0', false);
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);
  });

  it('contain', function () {
    let job = new Flow();

    let aBlock = job.createBlock('a');
    aBlock._load({
      '#is': 'contain',
      '0': 'abc',
      '1': 'b',
    });

    Root.run();

    assert.equal(aBlock.getValue('#output'), true);

    aBlock.setValue('1', 'd');
    Root.run();
    assert.equal(aBlock.getValue('#output'), false);

    // array input
    aBlock.setValue('0', ['a', 'd', 'g']);
    Root.run();
    assert.equal(aBlock.getValue('#output'), true);

    aBlock.setValue('0', []);
    Root.run();
    assert.equal(aBlock.getValue('#output'), false);

    // invalid input
    aBlock.setValue('0', 'a');
    aBlock.setValue('1', {});
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);

    // invalid input
    aBlock.setValue('0', false);
    Root.run();
    assert.equal(aBlock.getValue('#output'), undefined);
  });
});
