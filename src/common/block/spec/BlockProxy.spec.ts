import {assert} from "chai";
import {Job, Root} from "../Block";
import {BlockDeepProxy} from "../BlockProxy";

describe("BlockProxy", function() {

  it('basic', function() {
    let job = new Job();
    job.setValue('v1', 1);

    let bBlock = job.createBlock('b');
    bBlock.setValue('v2', 2);
    bBlock.setValue('v3', 3);
    bBlock.deleteValue('v3');
    bBlock.setValue('@v', '0'); // block attribute should not be iterated
    bBlock.createBlock('+v4').setValue('v', 4); // block helper should not be iterated
    bBlock.setBinding('v4', '+v4.v');
    let b: any = new Proxy(bBlock, BlockDeepProxy);

    assert.equal(b['###'].v1, 1);
    assert.equal(b.v2, 2);
    assert.equal(b['@v'], 0);
    assert.equal(('v3' in b), false);
    assert.equal(Object.prototype.hasOwnProperty.call(b, 'v4'), true);
    assert.equal(Object.isExtensible(b), true);

    let keys = [];
    for (let key in b) {
      keys.push(key);
    }
    keys.sort();
    assert.deepEqual(keys, ['v2', 'v4']);

    job.deleteValue('b');

    // block is destroyed
    // Proxy should act like an empty Object

    let keepStrictMode = Root.instance._strictMode;
    Root.instance._strictMode = false;

    assert.equal(b['###'], undefined, 'destroyed block should clear proxy');
    b.v2 = 22;
    assert.equal(b.v2, undefined);
    assert.deepEqual(Object.keys(b), []);

    Root.instance._strictMode = keepStrictMode;
  });
});
