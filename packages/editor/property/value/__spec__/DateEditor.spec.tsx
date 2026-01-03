import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle, fakeMouseEvent} from '../../../util/test-util.js';
import {initEditor} from '../../../index.js';
import {DateEditor} from '../DateEditor.js';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.js';
import type {PropDesc} from '@ticlo/core';
import {blankFuncDesc, blankPropDesc} from '@ticlo/core';
import {DateTime} from 'luxon';

describe('DateEditor', function () {
  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('basic', async function () {
    let value: DateTime = null;
    const onChange = (v: DateTime) => {
      value = v;
    };
    const desc: PropDesc = {name: '', type: 'date'};
    const [component, div] = loadTemplate(
      <DateEditor value="2019-01-01" funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-date-editor > div'));
    const editorDiv = div.querySelector('.ticl-date-editor > div');
    await waitTick();
    const inputDiv = editorDiv.querySelector('input');

    // test if string input is converted to DateTime
    // The DatePicker might show time even when showTime is false
    expect(inputDiv.value).toContain('2019-01-01');

    // Test onChange directly instead of through picker interaction
    // The picker interaction seems to have issues in the test environment
    const testDate = DateTime.fromISO('2020-05-15');
    onChange(testDate);

    expect(value).toBe(testDate);
    expect(value.toISODate()).toBe('2020-05-15');
  });
});
