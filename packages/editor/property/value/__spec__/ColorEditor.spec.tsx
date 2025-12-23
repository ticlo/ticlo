import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../util/test-util.js';
import {initEditor} from '../../../index.js';
import {ColorEditor} from '../ColorEditor.js';
import {shouldHappen} from '@ticlo/core/util/test-util.js';
import {blankFuncDesc, blankPropDesc, PropDesc} from '@ticlo/core';

describe('ColorEditor', function () {
  beforeEach(async function () {
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
    let desc: PropDesc = {name: '', type: 'color'};
    let [component, div] = loadTemplate(
      <ColorEditor value="#000000" funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-color-editor'), 200, 'editor should be created');
    let colorDiv = div.querySelector('.ticl-color-editor');

    simulate(colorDiv, 'click');

    await shouldHappen(
      () => querySingle("//div[@title='#FFFFFF']", document.body),
      200,
      'white block should show in color editor'
    );

    simulate(querySingle("//div[@title='#FFFFFF']", document.body), 'click');

    await shouldHappen(() => value === '#ffffff', 200, 'value should be white');
  });
});
