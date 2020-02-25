import {assert} from 'chai';
import '../../functions/basic/math/Arithmetic';
import '../../functions/script/Js';
import {
  blankPropDesc,
  buildPropDescCache,
  configDescs,
  findPropDesc,
  getOutputDesc,
  mapConfigDesc,
  PropDesc
} from '../Descriptor';
import {Functions} from '../Functions';

describe('Descriptor', function() {
  it('mapConfigDesc', function() {
    assert.isUndefined(mapConfigDesc(null));

    const abcconfig: PropDesc = {name: '#abc', type: 'string'};
    let mapped = mapConfigDesc(['#len', abcconfig]);
    assert.deepEqual(mapped, [configDescs['#len'], abcconfig]);
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
});
