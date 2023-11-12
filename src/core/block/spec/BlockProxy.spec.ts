import expect from 'expect';
import {Flow, Root} from '../Flow';
import {BlockDeepProxy, BlockProxy} from '../BlockProxy';
import {_strictMode} from '../BlockSettings';

describe('BlockProxy', function () {
  it('deep proxy', function () {
    let flow = new Flow();
    flow.setValue('v1', 1);

    let bBlock = flow.createBlock('b');
    bBlock.setValue('v2', 2);
    bBlock.setValue('v3', 3);
    bBlock.deleteValue('v3');
    bBlock.setValue('@v', '0'); // block attribute should not be iterated
    bBlock.createHelperBlock('v4').output(4); // property helper should not be iterated
    let b: any = new Proxy(bBlock, BlockDeepProxy);

    expect(b['###'].v1).toEqual(1);
    expect(b.v2).toEqual(2);
    expect(b['@v']).toEqual('0');
    expect(b['@notExist']).toEqual(undefined);
    expect('v3' in b).toEqual(false);
    expect(Object.prototype.hasOwnProperty.call(b, 'v4')).toEqual(true);
    expect(Object.isExtensible(b)).toEqual(true);

    let keys = [];
    for (let key in b) {
      keys.push(key);
    }
    keys.sort();
    expect(keys).toEqual(['v2', 'v4']);

    let keys2 = Object.keys(b);
    keys2.sort();
    expect(keys2).toEqual(['v2', 'v4']);

    flow.deleteValue('b');

    // block is destroyed
    // Proxy should act like an empty Object

    if (!_strictMode) {
      expect(b['###']).toEqual(undefined);
      b.v2 = 22;
      expect(b.v2).toEqual(undefined);
      expect(Object.keys(b)).toEqual([]);
    }
  });

  it('shallow proxy', function () {
    let flow = new Flow();
    flow.setValue('v1', 1);

    let bBlock = flow.createBlock('b');
    bBlock.setValue('v2', 2);
    bBlock.setValue('v3', 3);
    bBlock.deleteValue('v3');
    bBlock.setValue('@v', '0'); // block attribute should not be iterated
    bBlock.createHelperBlock('v4').output(4); // property helper should not be iterated
    let b: any = new Proxy(bBlock, BlockProxy);

    expect(b['###']).toEqual(flow);
    expect(b.v2).toEqual(2);
    expect(b['@v']).toEqual('0');
    expect(b['@notExist']).toEqual(undefined);
    expect('v3' in b).toEqual(false);
    expect(Object.prototype.hasOwnProperty.call(b, 'v4')).toEqual(true);
    expect(Object.isExtensible(b)).toEqual(true);

    let keys = [];
    for (let key in b) {
      keys.push(key);
    }
    keys.sort();
    expect(keys).toEqual(['v2', 'v4']);

    let keys2 = Object.keys(b);
    keys2.sort();
    expect(keys2).toEqual(['v2', 'v4']);

    flow.deleteValue('b');

    // block is destroyed
    // Proxy should act like an empty Object

    if (!_strictMode) {
      expect(b['###']).toEqual(undefined);
      b.v2 = 22;
      expect(b.v2).toEqual(undefined);
      expect(Object.keys(b)).toEqual([]);
    }
  });
});
