import {assert} from 'chai';
import SimulateEvent from 'simulate-event';
import React from 'react';
import {
  removeLastTemplate,
  loadTemplate,
  querySingle,
  fakeMouseEvent,
  expandDocumentBody
} from '../../../util/test-util';
import {initEditor} from '../../../index';
import {MultiSelectEditor, SelectEditor} from '../SelectEditor';
import {shouldHappen, waitTick} from '../../../../core/util/test-util';
import {blankPropDesc, PropDesc} from '../../../../core/block/Descriptor';

describe('SelectEditor', function() {
  beforeEach(async function() {
    expandDocumentBody();
    await initEditor();
  });

  afterEach(function() {
    removeLastTemplate();
  });

  it('basic', async function() {
    let value: string = null;
    let onChange = (v: string) => {
      value = v;
    };
    let desc: PropDesc = {name: '', type: 'select', options: ['a', 'b', 'c']};
    let [component, div] = loadTemplate(<SelectEditor value="a" desc={desc} onChange={onChange} />, 'editor');

    await shouldHappen(() => div.querySelector('.ant-select-selector'));
    let selectDiv = div.querySelector('.ant-select-selector');

    window.onerror = function(e) {};
    SimulateEvent.simulate(selectDiv, 'mousedown');
    await shouldHappen(() => querySingle("//div.ant-select-item-option-content[text()='b']", document.body));

    SimulateEvent.simulate(querySingle("//div.ant-select-item-option-content[text()='b']", document.body), 'click');

    assert.equal(value, 'b');
  });

  it('multi-select', async function() {
    let value: string[] = null;
    let onChange = (v: string[]) => {
      value = v;
    };
    let desc: PropDesc = {name: '', type: 'multi-select', options: ['a', 'b', 'c']};
    let [component, div] = loadTemplate(<MultiSelectEditor value={['a']} desc={desc} onChange={onChange} />, 'editor');
    await shouldHappen(() => div.querySelector('.ant-select-selector'));
    let selectDiv = div.querySelector('.ant-select-selector');

    window.onerror = function(e) {};
    SimulateEvent.simulate(selectDiv, 'mousedown');
    await shouldHappen(() => querySingle("//div.ant-select-item-option-content[text()='b']", document.body));

    SimulateEvent.simulate(querySingle("//div.ant-select-item-option-content[text()='b']", document.body), 'click');

    assert.deepEqual(value, ['a', 'b']);

    await waitTick();
  });
});
