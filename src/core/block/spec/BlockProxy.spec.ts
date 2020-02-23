import {assert} from 'chai';
import {Job, Root} from '../Job';
import {BlockDeepProxy, BlockProxy} from '../BlockProxy';
import {_strictMode} from '../BlockSettings';

describe('BlockProxy', function() {
  it('deep proxy', function() {
    let job = new Job();
    job.setValue('v1', 1);

    let bBlock = job.createBlock('b');
    bBlock.setValue('v2', 2);
    bBlock.setValue('v3', 3);
    bBlock.deleteValue('v3');
    bBlock.setValue('@v', '0'); // block attribute should not be iterated
    bBlock.createHelperBlock('v4').output(4); // property helper should not be iterated
    let b: any = new Proxy(bBlock, BlockDeepProxy);

    assert.equal(b['###'].v1, 1);
    assert.equal(b.v2, 2);
    assert.equal(b['@v'], 0);
    assert.equal(b['@notExist'], undefined);
    assert.equal('v3' in b, false);
    assert.equal(Object.prototype.hasOwnProperty.call(b, 'v4'), true);
    assert.equal(Object.isExtensible(b), true);

    let keys = [];
    for (let key in b) {
      keys.push(key);
    }
    keys.sort();
    assert.deepEqual(keys, ['v2', 'v4']);

    let keys2 = Object.keys(b);
    keys2.sort();
    assert.deepEqual(keys2, ['v2', 'v4']);

    job.deleteValue('b');

    // block is destroyed
    // Proxy should act like an empty Object

    if (!_strictMode) {
      assert.equal(b['###'], undefined, 'destroyed block should clear proxy');
      b.v2 = 22;
      assert.equal(b.v2, undefined);
      assert.deepEqual(Object.keys(b), []);
    }
  });

  it('shallow proxy', function() {
    let job = new Job();
    job.setValue('v1', 1);

    let bBlock = job.createBlock('b');
    bBlock.setValue('v2', 2);
    bBlock.setValue('v3', 3);
    bBlock.deleteValue('v3');
    bBlock.setValue('@v', '0'); // block attribute should not be iterated
    bBlock.createHelperBlock('v4').output(4); // property helper should not be iterated
    let b: any = new Proxy(bBlock, BlockProxy);

    assert.equal(b['###'], job);
    assert.equal(b.v2, 2);
    assert.equal(b['@v'], 0);
    assert.equal(b['@notExist'], undefined);
    assert.equal('v3' in b, false);
    assert.equal(Object.prototype.hasOwnProperty.call(b, 'v4'), true);
    assert.equal(Object.isExtensible(b), true);

    let keys = [];
    for (let key in b) {
      keys.push(key);
    }
    keys.sort();
    assert.deepEqual(keys, ['v2', 'v4']);

    let keys2 = Object.keys(b);
    keys2.sort();
    assert.deepEqual(keys2, ['v2', 'v4']);

    job.deleteValue('b');

    // block is destroyed
    // Proxy should act like an empty Object

    if (!_strictMode) {
      assert.equal(b['###'], undefined, 'destroyed block should clear proxy');
      b.v2 = 22;
      assert.equal(b.v2, undefined);
      assert.deepEqual(Object.keys(b), []);
    }
  });
});
