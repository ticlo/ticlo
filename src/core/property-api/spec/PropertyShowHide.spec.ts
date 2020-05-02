import {assert} from 'chai';

import {Flow, PropDesc, PropGroupDesc} from '../..';
import {showProperties, hideProperties, moveShownProperty, hideGroupProperties} from '../PropertyShowHide';

describe('PropertyOrder', function () {
  it('show hide Property', function () {
    let flow = new Flow();
    flow.load({
      '#is': 'add',
    });
    hideProperties(flow, ['@a']);
    assert.isUndefined(flow.getValue('@b-p'));

    showProperties(flow, ['@a']);
    assert.deepEqual(flow.getValue('@b-p'), ['@a']);

    showProperties(flow, ['@a']);
    assert.deepEqual(flow.getValue('@b-p'), ['@a']);

    hideProperties(flow, ['@b']); // remove a property not in the list
    assert.deepEqual(flow.getValue('@b-p'), ['@a']); // no change

    hideProperties(flow, ['@a']);
    assert.isUndefined(flow.getValue('@b-p'));
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
    assert.deepEqual(aBlock.getValue('@b-p'), ['#call', '1', 'bb']);

    showProperties(aBlock, ['1', '@a', 'aa', '#is', '5', '0']);
    assert.deepEqual(aBlock.getValue('@b-p'), ['#is', '#call', '0', '1', 'aa', 'bb', '@a', '5']);

    hideProperties(aBlock, ['aa', '1', '@a', '@b']);
    assert.deepEqual(aBlock.getValue('@b-p'), ['#is', '#call', '0', 'bb', '5']);
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
    assert.isUndefined(flow.getValue('@b-p'));

    flow.load({
      '#is': 'add',
      '@b-p': ['a', 'a1', 'b', 'a02', 'b0'],
    });

    hideGroupProperties(flow, descG, 'b');
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'a1', 'b', 'a02']);

    hideGroupProperties(flow, descG);
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'b']);
  });

  it('moveShownProperty', function () {
    let flow = new Flow();

    moveShownProperty(flow, 'a', 'b');
    assert.isUndefined(flow.getValue('@b-p'));

    showProperties(flow, ['a', 'b', 'c']);
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'b', 'c']);

    moveShownProperty(flow, 'a', 'b');
    assert.deepEqual(flow.getValue('@b-p'), ['b', 'a', 'c']);

    moveShownProperty(flow, 'a', 'b');
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'b', 'c']);

    moveShownProperty(flow, 'a', 'a');
    assert.deepEqual(flow.getValue('@b-p'), ['a', 'b', 'c']);
  });
});
