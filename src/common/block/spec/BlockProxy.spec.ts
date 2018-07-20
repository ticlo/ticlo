import {assert} from "chai";
import {Job, Root} from "../Job";
import {BlockDeepProxy} from "../BlockProxy";

describe("BlockProxy", () => {

  it('basic', () => {
    let job = new Job();
    job.setValue('v1', 1);

    let bBlock = job.createBlock('b');
    bBlock.setValue('v2', 2);
    bBlock.setValue('v3', 3);
    bBlock.deleteValue('v3');
    bBlock.setValue('v4', '4');

    let b: any = new Proxy(bBlock, BlockDeepProxy);

    assert.equal(b['###'].v1, 1);
    assert.equal(b.v2, 2);
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