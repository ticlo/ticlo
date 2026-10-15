import {expect} from 'vitest';
import '../../functions/math/Arithmetic.ts';
import '../../functions/data/State.ts';
import type {FunctionDesc, PropDesc, PropGroupDesc} from '../Descriptor.ts';
import {
  blankPropDesc,
  attributeDescs,
  buildPropDescCache,
  configDescs,
  findPropDesc,
  getDefaultDataFromCustom,
  getDefaultFuncData,
  getOutputDesc,
  getSubBlockFuncData,
  mapConfigDesc,
  mapAttributeDesc,
} from '../Descriptor.ts';
import {globalFunctions} from '../FunctionLib.ts';

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

  it('resolves named attributes and custom descriptors in the property cache', function () {
    expect(mapAttributeDesc(null)).toBeUndefined();
    const custom: PropDesc = {name: '@custom', type: 'string'};
    const attributes = ['@d-lock', '@invalid', '@d-seal', custom];
    const mapped = mapAttributeDesc(attributes);
    expect([...mapped]).toEqual([attributeDescs['@d-lock'], attributeDescs['@d-seal'], custom]);
    expect(mapAttributeDesc(mapped)).toBe(mapped);
    const cache = buildPropDescCache({name: 'example', attributes}, null);
    expect(findPropDesc('@d-lock', cache)).toBe(attributeDescs['@d-lock']);
    expect(findPropDesc('@d-seal', cache)).toBe(attributeDescs['@d-seal']);
    expect(findPropDesc('@custom', cache)).toBe(custom);
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

  it('applies function initial values over shared property initial values', function () {
    const properties: PropDesc[] = [
      {name: 'content', type: 'any', init: 'shared', pinned: true},
      {name: 'enabled', type: 'toggle', init: true},
      {name: 'style', type: 'object'},
    ];
    const desc: FunctionDesc = {
      name: 'example',
      id: 'example',
      properties,
      init: {content: 'example', style: {width: 200, height: 200}},
    };
    expect(getDefaultFuncData(desc)).toEqual({
      '#is': 'example',
      '@b-p': ['content'],
      'content': 'example',
      'enabled': true,
      'style': {width: 200, height: 200},
    });
    expect(getDefaultFuncData({...desc, init: {content: 'other'}}).content).toBe('other');
    expect(properties[0].init).toBe('shared');
  });

  it('copies nested function initial values for each new block', function () {
    const desc: FunctionDesc = {
      name: 'example',
      id: 'example',
      init: {style: {width: 200, height: 200}, items: [{label: 'initial'}]},
    };
    const first = getDefaultFuncData(desc);
    (first.style as {width: number}).width = 300;
    (first.items as {label: string}[])[0].label = 'changed';
    expect(getDefaultFuncData(desc)).toEqual({
      '#is': 'example',
      '@b-p': [],
      ...desc.init,
    });
    expect(desc.init.style).toEqual({width: 200, height: 200});
    expect(desc.init.items).toEqual([{label: 'initial'}]);
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
