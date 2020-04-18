import {assert} from 'chai';
import '../../functions/basic/math/Arithmetic';
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
    assert.isUndefined(mapConfigDesc(null));

    const abcconfig: PropDesc = {name: '#abc', type: 'string'};
    let mapped = mapConfigDesc(['#is', '#invalidConfig', abcconfig]);
    assert.deepEqual(mapped, [configDescs['#is'], abcconfig]);
    assert.equal(mapped, mapConfigDesc(mapped));
  });

  it('desc cache', function () {
    assert.isNull(buildPropDescCache(null, null));
    assert.equal(findPropDesc('a', null), blankPropDesc);

    let cache = buildPropDescCache(Functions.getDescToSend('add')[0], null);
    assert.equal(findPropDesc('', cache), blankPropDesc);
    assert.equal(findPropDesc('1', cache), cache['0']);
  });

  it('getOutputDesc', function () {
    assert.isNull(getOutputDesc(null));
    assert.isNull(getOutputDesc({name: ''}));
    assert.isNull(getOutputDesc(Functions.getDescToSend('js')[0]));
    assert.isNotNull(getOutputDesc(Functions.getDescToSend('add')[0]));
  });

  it('getDefaultFuncData', function () {
    assert.deepEqual(getSubBlockFuncData(getDefaultFuncData(Functions.getDescToSend('add')[0])), {
      '#is': 'add',
      '@b-p': ['0', '1'],
    });
    assert.deepEqual(getDefaultFuncData(Functions.getDescToSend('add')[0]), {
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
    assert.deepEqual(getDefaultDataFromCustom(custom), {
      '#is': '',
      '#custom': custom,
      'a': 'hello',
      '0': 'world',
      '@b-p': ['a'],
    });
  });
});
