import expect from 'expect';
import '../../functions/math/Arithmetic';
import '../../functions/script/Js';
import {
  blankPropDesc,
  buildPropDescCache,
  configDescs,
  findPropDesc,
  getDefaultDataFromCustom,
  getDefaultFuncData,
  getOutputDesc,
  getSubBlockFuncData,
  mapConfigDesc,
  PropDesc,
  PropGroupDesc,
} from '../Descriptor';
import {Functions} from '../Functions';

describe('Descriptor', function () {
  it('mapConfigDesc', function () {
    expect(mapConfigDesc(null)).not.toBeDefined();

    const abcconfig: PropDesc = {name: '#abc', type: 'string'};
    let mapped = mapConfigDesc(['#is', '#invalidConfig', abcconfig]);
    expect([...mapped]).toEqual([configDescs['#is'], abcconfig]);
    expect(mapped).toEqual(mapConfigDesc(mapped));
  });

  it('desc cache', function () {
    expect(buildPropDescCache(null, null)).toBeNull();
    expect(findPropDesc('a', null)).toEqual(blankPropDesc);

    let cache = buildPropDescCache(Functions.getDescToSend('add')[0], null);
    expect(findPropDesc('', cache)).toEqual(blankPropDesc);
    expect(findPropDesc('1', cache)).toEqual(cache['0']);
  });

  it('getOutputDesc', function () {
    expect(getOutputDesc(null)).toBeNull();
    expect(getOutputDesc({name: ''})).toBeNull();
    expect(getOutputDesc(Functions.getDescToSend('js')[0])).toBeNull();
    expect(getOutputDesc(Functions.getDescToSend('add')[0])).not.toBeNull();
  });

  it('getDefaultFuncData', function () {
    expect(getSubBlockFuncData(getDefaultFuncData(Functions.getDescToSend('add')[0]))).toEqual({
      '#is': 'add',
      '@b-p': ['0', '1'],
    });
    expect(getDefaultFuncData(Functions.getDescToSend('add')[0])).toEqual({
      '#is': 'add',
      '@b-p': ['0', '1', '#output'],
    });
  });

  it('getDefaultDataFromCustom', function () {
    let custom: (PropDesc | PropGroupDesc)[] = [
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
