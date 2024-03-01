import {expect} from 'vitest';

import {Flow, PropDesc, PropGroupDesc} from '../..';
import {showProperties, hideProperties, moveShownProperty, hideGroupProperties} from '../PropertyShowHide';

describe('PropertyOrder', function () {
  it('show hide Property', function () {
    let flow = new Flow();
    flow.load({
      '#is': 'add',
    });
    hideProperties(flow, ['@a']);
    expect(flow.getValue('@b-p')).not.toBeDefined();

    showProperties(flow, ['@a']);
    expect(flow.getValue('@b-p')).toEqual(['@a']);

    showProperties(flow, ['@a']);
    expect(flow.getValue('@b-p')).toEqual(['@a']);

    hideProperties(flow, ['@b']); // remove a property not in the list
    expect(flow.getValue('@b-p')).toEqual(['@a']); // no change

    hideProperties(flow, ['@a']);
    expect(flow.getValue('@b-p')).not.toBeDefined();
  });

  it('show hide Properties with order', function () {
    let flow = new Flow();
    let aBlock = flow.createBlock('a');
    aBlock._load({
      '#is': 'add',
      '#custom': [
        {name: 'aa', type: 'number'},
        {name: 'bb', type: 'string'},
      ],
    });

    showProperties(aBlock, ['#call', '1', 'bb']);
    expect(aBlock.getValue('@b-p')).toEqual(['#call', '1', 'bb']);

    showProperties(aBlock, ['1', '@a', 'aa', '#is', '5', '0']);
    expect(aBlock.getValue('@b-p')).toEqual(['#is', '#call', '0', '1', 'aa', 'bb', '@a', '5']);

    hideProperties(aBlock, ['aa', '1', '@a', '@b']);
    expect(aBlock.getValue('@b-p')).toEqual(['#is', '#call', '0', 'bb', '5']);
  });

  it('hideGroupProperties', function () {
    let descG: PropGroupDesc = {
      name: 'g',
      type: 'group',
      defaultLen: 2,
      properties: [{name: 'a', type: 'string'}],
    };

    let flow = new Flow();

    hideGroupProperties(flow, descG);
    hideGroupProperties(flow, descG, 'a');
    expect(flow.getValue('@b-p')).not.toBeDefined();

    flow.load({
      '#is': 'add',
      '@b-p': ['a', 'a1', 'b', 'a02', 'b0'],
    });

    hideGroupProperties(flow, descG, 'b');
    expect(flow.getValue('@b-p')).toEqual(['a', 'a1', 'b', 'a02']);

    hideGroupProperties(flow, descG);
    expect(flow.getValue('@b-p')).toEqual(['a', 'b']);
  });

  it('moveShownProperty', function () {
    let flow = new Flow();

    moveShownProperty(flow, 'a', 'b');
    expect(flow.getValue('@b-p')).not.toBeDefined();

    showProperties(flow, ['a', 'b', 'c']);
    expect(flow.getValue('@b-p')).toEqual(['a', 'b', 'c']);

    moveShownProperty(flow, 'a', 'b');
    expect(flow.getValue('@b-p')).toEqual(['b', 'a', 'c']);

    moveShownProperty(flow, 'a', 'b');
    expect(flow.getValue('@b-p')).toEqual(['a', 'b', 'c']);

    moveShownProperty(flow, 'a', 'a');
    expect(flow.getValue('@b-p')).toEqual(['a', 'b', 'c']);
  });
});
