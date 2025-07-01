import {expect} from 'vitest';
import SimulateEvent from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle, fakeMouseEvent} from '../../../util/test-util';
import {initEditor} from '../../../index';
import {DateEditor} from '../DateEditor';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util';
import {blankFuncDesc, blankPropDesc, PropDesc} from '@ticlo/core';
import dayjs, {Dayjs} from 'dayjs';

describe('DateEditor', function () {
  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('basic', async function () {
    let value: Dayjs = null;
    let onChange = (v: Dayjs) => {
      value = v;
    };
    let desc: PropDesc = {name: '', type: 'date'};
    let [component, div] = loadTemplate(
      <DateEditor value="2019-01-01" funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-date-editor > div'));
    let editorDiv = div.querySelector('.ticl-date-editor > div');
    await waitTick();
    let inputDiv = editorDiv.querySelector('input');

    // test if string input is converted to dayjs
    expect(inputDiv.value).toBe('2019-01-01');

    SimulateEvent.simulate(inputDiv, 'mousedown', fakeMouseEvent());

    await shouldHappen(() => document.querySelector('.ant-picker-today-btn'));

    SimulateEvent.simulate(document.querySelector('.ant-picker-today-btn'), 'click');

    await shouldHappen(() => value != null);
    let valueNow = dayjs();
    expect(Math.abs(value.valueOf() - valueNow.valueOf())).toBeLessThanOrEqual(1000);
  });
});
