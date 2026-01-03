import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../util/test-util.js';
import {initEditor} from '../../../index.js';
import {RadioButtonEditor} from '../RadioButtonEditor.js';
import {shouldHappen} from '@ticlo/core/util/test-util.js';
import type { PropDesc} from '@ticlo/core';
import {blankFuncDesc, blankPropDesc} from '@ticlo/core';
import {DateEditor} from '../DateEditor.js';

describe('RadioButtonEditor', function () {
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
    const desc: PropDesc = {name: '', type: 'select', options: ['a', 'b', 'c']};
    const [component, div] = loadTemplate(
      <RadioButtonEditor value="a" funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelectorAll('.ant-radio-button').length === 3);
    const buttons = div.querySelectorAll('.ant-radio-button');

    simulate(buttons[1], 'click');
    await shouldHappen(() => value === 'b');
  });
});
