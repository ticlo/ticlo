import {assert} from 'chai';
import SimulateEvent from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../../ui/util/test-util';
import {initEditor} from '../../../index';
import {DateRangeEditor} from '../DateRangeEditor';
import {shouldHappen, waitTick} from '../../../../core/util/test-util';
import {blankPropDesc, PropDesc} from '../../../../core/block/Descriptor';
import moment, {Moment} from 'moment';

describe('DateRangeEditor', function() {
  beforeEach(async function() {
    await initEditor();
  });

  afterEach(async function() {
    removeLastTemplate();
  });

  it('basic', async function() {
    let values: Moment[] = null;
    let onChange = (v: Moment[]) => {
      values = v;
    };
    let desc: PropDesc = {name: '', type: 'date-range', showTime: true};
    let [component, div] = loadTemplate(<DateRangeEditor value={null} desc={desc} onChange={onChange} />, 'editor');

    await shouldHappen(() => div.querySelector('.ticl-date-range-editor > span'));
    let dateRangeDiv = div.querySelector('.ticl-date-range-editor > span');

    // dont run the following test because of issue that karma skipping tests after this one
    window.onerror = function(e) {};

    SimulateEvent.simulate(dateRangeDiv, 'click');

    await shouldHappen(() => document.querySelector('.ant-calendar-date'));

    let dateCell = document.querySelector('.ant-calendar-date');
    let dateStr = dateCell.parentElement.title;
    // click twice
    SimulateEvent.simulate(dateCell, 'click');
    SimulateEvent.simulate(dateCell, 'click');

    await shouldHappen(() => values != null);
    let clickedMoment = moment(dateStr, 'MMM D, YYYY');
    assert.isTrue(clickedMoment.isSameOrBefore(values[0]));
    assert.isTrue(clickedMoment.isBefore(values[1]));
  });
});
