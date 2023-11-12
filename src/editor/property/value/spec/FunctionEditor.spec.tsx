import expect from 'expect';
import SimulateEvent from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../util/test-util';
import {initEditor} from '../../../index';
import {FunctionEditor} from '../FunctionEditor';
import {shouldHappen} from '../../../../core/util/test-util';
import {blankFuncDesc, blankPropDesc, PropDesc} from '../../../../../src/core/editor';
import {makeLocalConnection} from '../../../../core/connect/LocalConnection';
import {Root} from '../../../../../src/core';
import {DateEditor} from '../DateEditor';

describe('TypeEditor', function () {
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
      <FunctionEditor value="" conn={client} funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.anticon-down'));

    // work around of browser size causing  ResizeObserver - loop limit exceeded  Error
    window.onerror = function (e) {};
    SimulateEvent.simulate(div.querySelector('.anticon-down'), 'click');
    await shouldHappen(() => querySingle("//div.ticl-tree-type/span[text()='math']", document.body));

    SimulateEvent.simulate(
      querySingle("//div.ticl-tree-type/span[text()='math']/../div.ticl-tree-arr", document.body),
      'click'
    );

    await shouldHappen(() => querySingle("//div.ticl-func-view/span[text()='add']", document.body));

    SimulateEvent.simulate(querySingle("//div.ticl-func-view/span[text()='add']/..", document.body), 'click');

    await shouldHappen(() => value === 'add');

    client.destroy();
  });
});
