import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle, fakeMouseEvent} from '../../../util/test-util';
import {initEditor} from '../../../index';
import {DateRangeEditor} from '../DateRangeEditor';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util';
import {blankFuncDesc, blankPropDesc, PropDesc} from '@ticlo/core';
import {DateTime} from 'luxon';

describe('DateRangeEditor', function () {
  beforeEach(async function () {
    await initEditor();
  });

  afterEach(async function () {
    removeLastTemplate();
  });

  it('basic', async function () {
    let values: DateTime[] = null;
    let onChange = (v: DateTime[]) => {
      values = v;
    };
    let desc: PropDesc = {name: '', type: 'date-range', showTime: false};
    let [component, div] = loadTemplate(
      <DateRangeEditor value={null} funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-date-range-editor > div'), 500);
    let dateRangeDiv = div.querySelector('.ticl-date-range-editor > div');

    // don't run the following test because of issue that karma skipping tests after this one
    window.onerror = function (e) {};

    simulate(dateRangeDiv.querySelector('input'), 'mousedown', fakeMouseEvent());

    await shouldHappen(() => document.querySelector('.ant-picker-panels'));
    let dateCell = document.querySelector('.ant-picker-cell-today');
    let dateStr = (dateCell as HTMLElement).title;
    // click twice
    simulate(dateCell, 'click');
    await waitTick(1);
    simulate(dateCell, 'click');

    await shouldHappen(() => values != null);
    let clickedDate = DateTime.fromFormat(dateStr, 'yyyy-MM-dd');
    expect(clickedDate < values[1]).toBe(true);
  });
});
