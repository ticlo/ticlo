import {expect} from 'vitest';
import {simulate} from 'simulate-event';
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
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util';
import {blankFuncDesc, blankPropDesc, PropDesc} from '@ticlo/core';
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

    await shouldHappen(() => div.querySelector('.ant-select'), 2000);
    let selectDiv = div.querySelector('.ant-select');

    // window.onerror = function (e) {};
    let trigger = div.querySelector('input') || div.querySelector('.ant-select-selector') || selectDiv;
    simulate(trigger, 'mousedown');
    await shouldHappen(() => querySingle("//div.ant-select-item-option-content/span[text()='b']", document.body), 3000);

    simulate(querySingle("//div.ant-select-item-option-content/span[text()='b']", document.body), 'click');

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
    await shouldHappen(() => div.querySelector('.ant-select'), 2000);
    let selectDiv = div.querySelector('.ant-select');

    // window.onerror = function (e) {};
    let trigger = div.querySelector('input') || div.querySelector('.ant-select-selector') || selectDiv;
    simulate(trigger, 'mousedown');

    await shouldHappen(() => querySingle("//div.ant-select-item-option-content/span[text()='b']", document.body), 3000);

    simulate(querySingle("//div.ant-select-item-option-content/span[text()='b']", document.body), 'click');

    expect(value).toEqual(['a', 'b']);

    await waitTick();
  });
});
