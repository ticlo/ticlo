import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../util/test-util.js';
import {initEditor} from '../../../index.js';
import {ColorEditor} from '../ColorEditor.js';
import {shouldHappen} from '@ticlo/core/util/test-util.js';
import type { PropDesc} from '@ticlo/core';
import {blankFuncDesc, blankPropDesc} from '@ticlo/core';

describe('ColorEditor', function () {
  beforeEach(async function () {
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
    const desc: PropDesc = {name: '', type: 'color'};
    const [component, div] = loadTemplate(
      <ColorEditor value="#000000" funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ant-color-picker-trigger'), 200, 'editor should be created');
    const colorDiv = div.querySelector('.ant-color-picker-trigger');

    await shouldHappen(() => colorDiv.textContent.includes('#000000'), 200, 'should display color value');

    simulate(colorDiv, 'click');

    await shouldHappen(
      () => document.querySelector('.ant-color-picker-panel'), // or .ant-popover
      500,
      'color picker popup should open'
    );

    // TODO: verify interactions with ant design color picker
    // simulate(querySingle("//div[@title='#FFFFFF']", document.body), 'click');
    // await shouldHappen(() => value === '#ffffff', 200, 'value should be white');
  });
});
