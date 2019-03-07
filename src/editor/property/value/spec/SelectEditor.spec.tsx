import {assert} from "chai";
import SimulateEvent from "simulate-event";
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from "../../../../ui/util/test-util";
import {initEditor} from "../../../index";
import {SelectEditor} from "../SelectEditor";
import {shouldHappen} from "../../../../core/util/test-util";
import {blankPropDesc, PropDesc} from "../../../../core/block/Descriptor";

describe("SelectEditor", function () {

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
    let desc: PropDesc = {name: '', type: 'select', options: ['a', 'b', 'c']};
    let [component, div] = loadTemplate(
      <SelectEditor value='a' desc={desc} onChange={onChange}/>, 'editor');

    await shouldHappen(() => div.querySelector('.ant-select'));
    let selectDiv = div.querySelector('.ant-select');

    SimulateEvent.simulate(selectDiv, 'click');

    await shouldHappen(() => querySingle("//li.ant-select-dropdown-menu-item[text()='b']", div));

    SimulateEvent.simulate(querySingle("//li.ant-select-dropdown-menu-item[text()='b']", div), 'click');

    assert.equal(value, 'b');
  });


});
