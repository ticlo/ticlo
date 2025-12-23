import {expect} from 'vitest';
import {Flow, Root} from '../Flow.js';
import {BlockDeepProxy, BlockProxy} from '../BlockProxy.js';
import {_strictMode} from '../BlockSettings.js';

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

    expect(b['###'].v1).toBe(1);
    expect(b.v2).toBe(2);
    expect(b['@v']).toBe('0');
    expect(b['@notExist']).toBe(undefined);
    expect('v3' in b).toBe(false);
    expect(Object.hasOwn(b, 'v4')).toBe(true);
    expect(Object.isExtensible(b)).toBe(true);

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
      expect(b['###']).toBe(undefined);
      b.v2 = 22;
      expect(b.v2).toBe(undefined);
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

    expect(b['###']).toBe(flow);
    expect(b.v2).toBe(2);
    expect(b['@v']).toBe('0');
    expect(b['@notExist']).toBe(undefined);
    expect('v3' in b).toBe(false);
    expect(Object.hasOwn(b, 'v4')).toBe(true);
    expect(Object.isExtensible(b)).toBe(true);

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
      expect(b['###']).toBe(undefined);
      b.v2 = 22;
      expect(b.v2).toBe(undefined);
      expect(Object.keys(b)).toEqual([]);
    }
  });
});
