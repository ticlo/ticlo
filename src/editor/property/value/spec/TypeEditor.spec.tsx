import {assert} from "chai";
import SimulateEvent from "simulate-event";
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from "../../../../ui/util/test-util";
import {initEditor} from "../../../index";
import {TypeEditor} from "../TypeEditor";
import {shouldHappen} from "../../../../core/util/test-util";
import {blankPropDesc, PropDesc} from "../../../../core/block/Descriptor";
import {makeLocalConnection} from "../../../../core/connect/LocalConnection";
import {Root} from "../../../../core/block/Block";

describe("SelectEditor", function () {

  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('expand type editor', async function () {
    let [server, client] = makeLocalConnection(Root.instance, true);

    let value: string = null;
    let onChange = (v: string) => {
      value = v;
    };
    let desc: PropDesc = {name: '', type: 'type'};
    let [component, div] = loadTemplate(
      <TypeEditor value='' conn={client} desc={desc} onChange={onChange}/>, 'editor');

    await shouldHappen(() => div.querySelector('.anticon-down'));
    SimulateEvent.simulate(div.querySelector('.anticon-down'), 'click');

    await shouldHappen(() => querySingle("//div.ticl-tree-type/span[text()='math']", document.body));

    SimulateEvent.simulate(querySingle("//div.ticl-tree-type/span[text()='math']/../div.ticl-tree-arr", document.body), 'click');

    await shouldHappen(() => querySingle("//div.ticl-type-view/span[text()='add']", document.body));

    SimulateEvent.simulate(querySingle("//div.ticl-type-view/span[text()='add']/..", document.body), 'click');

    await shouldHappen(() => value === 'add');

    client.destroy();
  });
});