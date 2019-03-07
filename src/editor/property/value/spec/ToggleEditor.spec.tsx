import {assert} from "chai";
import SimulateEvent from "simulate-event";
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from "../../../../ui/util/test-util";
import {initEditor} from "../../../index";
import {ToggleEditor} from "../ToggleEditor";
import {shouldHappen} from "../../../../core/util/test-util";
import {blankPropDesc, PropDesc} from "../../../../core/block/Descriptor";

describe("ToggleEditor", function () {

  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('click to true', async function () {
    let value: boolean = null;
    let onChange = (v: boolean) => {
      value = v;
    };
    let [component, div] = loadTemplate(
      <ToggleEditor value={false} desc={blankPropDesc} onChange={onChange}/>, 'editor');

    await shouldHappen(() => div.querySelector('.ant-switch'));
    let switchButton = div.querySelector('.ant-switch');

    SimulateEvent.simulate(switchButton, 'click');
    assert.isTrue(value);
  });

  it('click to false', async function () {
    let value: boolean = null;
    let onChange = (v: boolean) => {
      value = v;
    };
    let [component, div] = loadTemplate(
      <ToggleEditor value={true} desc={blankPropDesc} onChange={onChange}/>, 'editor');

    await shouldHappen(() => div.querySelector('.ant-switch'));
    let switchButton = div.querySelector('.ant-switch');

    SimulateEvent.simulate(switchButton, 'click');
    assert.isFalse(value);
  });

  it('click to true string', async function () {
    let value: any = null;
    let onChange = (v: any) => {
      value = v;
    };
    let desc: PropDesc = {name: '', type: 'toggle', options: ['a', 'b']};
    let [component, div] = loadTemplate(
      <ToggleEditor value='a' desc={desc} onChange={onChange}/>, 'editor');

    await shouldHappen(() => div.querySelector('.ant-switch'));
    let switchButton = div.querySelector('.ant-switch');

    SimulateEvent.simulate(switchButton, 'click');
    assert.equal(value, 'b');
  });

  it('click to false string', async function () {
    let value: any = null;
    let onChange = (v: any) => {
      value = v;
    };
    let desc: PropDesc = {name: '', type: 'toggle', options: ['a', 'b']};
    let [component, div] = loadTemplate(
      <ToggleEditor value='b' desc={desc} onChange={onChange}/>, 'editor');

    await shouldHappen(() => div.querySelector('.ant-switch'));
    let switchButton = div.querySelector('.ant-switch');

    SimulateEvent.simulate(switchButton, 'click');
    assert.equal(value, 'a');
  });

});
