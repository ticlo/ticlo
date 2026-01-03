import {expect} from 'vitest';
import '../../functions/math/Arithmetic.js';
import '../../functions/data/State.js';
import type {
  PropDesc,
  PropGroupDesc} from '../Descriptor.js';
import {
  blankPropDesc,
  buildPropDescCache,
  configDescs,
  findPropDesc,
  getDefaultDataFromCustom,
  getDefaultFuncData,
  getOutputDesc,
  getSubBlockFuncData,
  mapConfigDesc
} from '../Descriptor.js';
import {globalFunctions} from '../Functions.js';

describe('Descriptor', function () {
  it('mapConfigDesc', function () {
    expect(mapConfigDesc(null)).not.toBeDefined();

    const abcconfig: PropDesc = {name: '#abc', type: 'string'};
    const mapped = mapConfigDesc(['#is', '#invalidConfig', abcconfig]);
    expect([...mapped]).toEqual([configDescs['#is'], abcconfig]);
    expect(mapped).toBe(mapConfigDesc(mapped));
  });

  it('desc cache', function () {
    expect(buildPropDescCache(null, null)).toBeNull();
    expect(findPropDesc('a', null)).toBe(blankPropDesc);

    const cache = buildPropDescCache(globalFunctions.getDescToSend('add')[0], null);
    expect(findPropDesc('', cache)).toBe(blankPropDesc);
    expect(findPropDesc('1', cache)).toBe(cache['0']);
  });

  it('getOutputDesc', function () {
    expect(getOutputDesc(null)).toBeNull();
    expect(getOutputDesc({name: ''})).toBeNull();
    expect(getOutputDesc(globalFunctions.getDescToSend('set-state')[0])).toBeNull();
    expect(getOutputDesc(globalFunctions.getDescToSend('add')[0])).not.toBeNull();
  });

  it('getDefaultFuncData', function () {
    expect(getSubBlockFuncData(getDefaultFuncData(globalFunctions.getDescToSend('add')[0]))).toEqual({
      '#is': 'add',
      '@b-p': ['0', '1'],
    });
    expect(getDefaultFuncData(globalFunctions.getDescToSend('add')[0])).toEqual({
      '#is': 'add',
      '@b-p': ['0', '1', '#output'],
    });
  });

  it('getDefaultDataFromCustom', function () {
    const custom: (PropDesc | PropGroupDesc)[] = [
      {name: 'a', type: 'string', init: 'hello', pinned: true},
      {
        name: '',
        type: 'group',
        defaultLen: 1,
        properties: [{name: '', type: 'string', init: 'world'}],
      },
    ];
    expect(getDefaultDataFromCustom(custom)).toEqual({
      '#is': '',
      '#custom': custom,
      'a': 'hello',
      '0': 'world',
      '@b-p': ['a', '0'],
    });
  });
});
