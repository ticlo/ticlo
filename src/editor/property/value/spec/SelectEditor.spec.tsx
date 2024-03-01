import {expect} from 'vitest';
import SimulateEvent from 'simulate-event';
import React from 'react';
import {
  removeLastTemplate,
  loadTemplate,
  querySingle,
  fakeMouseEvent,
  expandDocumentBody,
} from '../../../util/test-util';
import {initEditor} from '../../../index';
import {MultiSelectEditor, SelectEditor} from '../SelectEditor';
import {shouldHappen, waitTick} from '../../../../../src/core/util/test-util';
import {blankFuncDesc, blankPropDesc, PropDesc} from '../../../../../src/core/editor';
import {DateEditor} from '../DateEditor';

describe('SelectEditor', function () {
  beforeEach(async function () {
    expandDocumentBody();
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('basic', async function () {
    let value: string = null;
    let onChange = (v: string) => {
      value = v;
    };
    let desc: PropDesc = {name: '', type: 'select', options: ['a', 'b', 'c']};
    let [component, div] = loadTemplate(
      <SelectEditor value="a" funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ant-select-selector'));
    let selectDiv = div.querySelector('.ant-select-selector');

    window.onerror = function (e) {};
    SimulateEvent.simulate(selectDiv, 'mousedown');
    await shouldHappen(() => querySingle("//div.ant-select-item-option-content/span[text()='b']", document.body));

    SimulateEvent.simulate(
      querySingle("//div.ant-select-item-option-content/span[text()='b']", document.body),
      'click'
    );

    expect(value).toBe('b');
  });

  it('multi-select', async function () {
    let value: string[] = null;
    let onChange = (v: string[]) => {
      value = v;
    };
    let desc: PropDesc = {name: '', type: 'multi-select', options: ['a', 'b', 'c']};
    let [component, div] = loadTemplate(
      <MultiSelectEditor value={['a']} funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );
    await shouldHappen(() => div.querySelector('.ant-select-selector'));
    let selectDiv = div.querySelector('.ant-select-selector');

    window.onerror = function (e) {};
    SimulateEvent.simulate(selectDiv, 'mousedown');
    await shouldHappen(() => querySingle("//div.ant-select-item-option-content/span[text()='b']", document.body));

    SimulateEvent.simulate(
      querySingle("//div.ant-select-item-option-content/span[text()='b']", document.body),
      'click'
    );

    expect(value).toEqual(['a', 'b']);

    await waitTick();
  });
});
