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
  mapConfigDesc,
  PropDesc,
  PropGroupDesc,
  shouldShowProperty
} from '../Descriptor';
import {Functions} from '../Functions';

describe('Descriptor', function() {
  it('mapConfigDesc', function() {
    assert.isUndefined(mapConfigDesc(null));

    const abcconfig: PropDesc = {name: '#abc', type: 'string'};
    let mapped = mapConfigDesc(['#is', '#invalidConfig', abcconfig]);
    assert.deepEqual(mapped, [configDescs['#is'], abcconfig]);
    assert.equal(mapped, mapConfigDesc(mapped));
  });

  it('desc cache', function() {
    assert.isNull(buildPropDescCache(null, null));
    assert.equal(findPropDesc('a', null), blankPropDesc);

    let cache = buildPropDescCache(Functions.getDescToSend('add')[0], null);
    assert.equal(findPropDesc('', cache), blankPropDesc);
    assert.equal(findPropDesc('1', cache), cache['0']);
  });

  it('getOutputDesc', function() {
    assert.isNull(getOutputDesc(null));
    assert.isNull(getOutputDesc({name: ''}));
    assert.isNull(getOutputDesc(Functions.getDescToSend('js')[0]));
    assert.isNotNull(getOutputDesc(Functions.getDescToSend('add')[0]));
  });

  it('shouldShowProperty', function() {
    assert.isTrue(shouldShowProperty('high', true));
    assert.isTrue(shouldShowProperty('high', false));

    assert.isFalse(shouldShowProperty('low', true));
    assert.isFalse(shouldShowProperty('low', false));

    assert.isFalse(shouldShowProperty(undefined, true));
    assert.isTrue(shouldShowProperty(undefined, false));
  });

  it('getDefaultFuncData', function() {
    assert.deepEqual(getDefaultFuncData(Functions.getDescToSend('add')[0], true), {'#is': 'add', '@b-p': ['0', '1']});
    assert.deepEqual(getDefaultFuncData(Functions.getDescToSend('add')[0], false), {
      '#is': 'add',
      '@b-p': ['0', '1', '#output']
    });
  });

  it('getDefaultDataFromCustom', function() {
    let custom: (PropDesc | PropGroupDesc)[] = [
      {name: 'a', type: 'string', init: 'hello'},
      {
        name: '',
        type: 'group',
        defaultLen: 1,
        properties: [{name: '', type: 'string', visible: 'low', init: 'world'}]
      }
    ];
    assert.deepEqual(getDefaultDataFromCustom(custom), {
      '#is': '',
      '#custom': custom,
      'a': 'hello',
      '0': 'world',
      '@b-p': ['a']
    });
  });
});
