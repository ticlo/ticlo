import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../util/test-util.js';
import {initEditor} from '../../../index.js';
import {ToggleEditor} from '../ToggleEditor.js';
import {shouldHappen} from '@ticlo/core/util/test-util.js';
import type { PropDesc} from '@ticlo/core';
import {blankFuncDesc, blankPropDesc} from '@ticlo/core';
import {DateEditor} from '../DateEditor.js';

describe('ToggleEditor', function () {
  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('click to true', async function () {
    let value: boolean = null;
    const onChange = (v: boolean) => {
      value = v;
    };
    const [component, div] = loadTemplate(
      <ToggleEditor value={false} funcDesc={blankFuncDesc} desc={blankPropDesc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ant-switch'));
    const switchButton = div.querySelector('.ant-switch');

    simulate(switchButton, 'click');
    expect(value).toBe(true);
  });

  it('click to false', async function () {
    let value: boolean = null;
    const onChange = (v: boolean) => {
      value = v;
    };
    const [component, div] = loadTemplate(
      <ToggleEditor value={true} funcDesc={blankFuncDesc} desc={blankPropDesc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ant-switch'));
    const switchButton = div.querySelector('.ant-switch');

    simulate(switchButton, 'click');
    expect(value).toBe(false);
  });

  it('click to true string', async function () {
    let value: any = null;
    const onChange = (v: any) => {
      value = v;
    };
    const desc: PropDesc = {name: '', type: 'toggle', options: ['a', 'b']};
    const [component, div] = loadTemplate(
      <ToggleEditor value="a" funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ant-switch'));
    const switchButton = div.querySelector('.ant-switch');

    simulate(switchButton, 'click');
    expect(value).toBe('b');
  });

  it('click to false string', async function () {
    let value: any = null;
    const onChange = (v: any) => {
      value = v;
    };
    const desc: PropDesc = {name: '', type: 'toggle', options: ['a', 'b']};
    const [component, div] = loadTemplate(
      <ToggleEditor value="b" funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ant-switch'));
    const switchButton = div.querySelector('.ant-switch');

    simulate(switchButton, 'click');
    expect(value).toBe('a');
  });
});
