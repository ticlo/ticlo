import {assert} from "chai";
import SimulateEvent from "simulate-event";
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from "../../../../ui/util/test-util";
import {initEditor} from "../../../index";
import {DateEditor} from "../DateEditor";
import {shouldHappen} from "../../../../core/util/test-util";
import {blankPropDesc, PropDesc} from "../../../../core/block/Descriptor";
import {Moment, now} from "moment";

describe("SelectEditor", function () {

  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('basic', async function () {
    let value: Moment = null;
    let onChange = (v: Moment) => {
      value = v;
    };
    let desc: PropDesc = {name: '', type: 'date'};
    let [component, div] = loadTemplate(
      <DateEditor value={null} desc={desc} onChange={onChange}/>, 'editor');

    await shouldHappen(() => div.querySelector('.ticl-date-editor > div'));
    let colorDiv = div.querySelector('.ticl-date-editor > div');

    SimulateEvent.simulate(colorDiv, 'click');

    await shouldHappen(() => document.querySelector('.ant-calendar-today-btn'));

    SimulateEvent.simulate(document.querySelector('.ant-calendar-today-btn'), 'click');

    await shouldHappen(() => value != null);
    let valueNow = now();
    assert.approximately(value.valueOf(), valueNow.valueOf(), 1000);
  });
});
