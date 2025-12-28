import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {
  removeLastTemplate,
  loadTemplate,
  querySingle,
  fakeMouseEvent,
  expandDocumentBody,
} from '../../../util/test-util.js';
import {initEditor} from '../../../index.js';
import {MultiSelectEditor, SelectEditor} from '../SelectEditor.js';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.js';
import {blankFuncDesc, blankPropDesc, PropDesc} from '@ticlo/core';
import {DateEditor} from '../DateEditor.js';

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
    const onChange = (v: string) => {
      value = v;
    };
    const desc: PropDesc = {name: '', type: 'select', options: ['a', 'b', 'c']};
    const [component, div] = loadTemplate(
      <SelectEditor value="a" funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ant-select'), 2000);
    const selectDiv = div.querySelector('.ant-select');

    // window.onerror = function (e) {};
    const trigger = div.querySelector('input') || div.querySelector('.ant-select-selector') || selectDiv;
    simulate(trigger, 'mousedown');
    await shouldHappen(() => querySingle("//div.ant-select-item-option-content/span[text()='b']", document.body), 3000);

    simulate(querySingle("//div.ant-select-item-option-content/span[text()='b']", document.body), 'click');

    expect(value).toBe('b');
  });

  it('multi-select', async function () {
    let value: string[] = null;
    const onChange = (v: string[]) => {
      value = v;
    };
    const desc: PropDesc = {name: '', type: 'multi-select', options: ['a', 'b', 'c']};
    const [component, div] = loadTemplate(
      <MultiSelectEditor value={['a']} funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );
    await shouldHappen(() => div.querySelector('.ant-select'), 2000);
    const selectDiv = div.querySelector('.ant-select');

    // window.onerror = function (e) {};
    const trigger = div.querySelector('input') || div.querySelector('.ant-select-selector') || selectDiv;
    simulate(trigger, 'mousedown');

    await shouldHappen(() => querySingle("//div.ant-select-item-option-content/span[text()='b']", document.body), 3000);

    simulate(querySingle("//div.ant-select-item-option-content/span[text()='b']", document.body), 'click');

    expect(value).toEqual(['a', 'b']);

    await waitTick();
  });
});
