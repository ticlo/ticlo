import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../util/test-util.js';
import {initEditor} from '../../../index.js';
import {FunctionEditor} from '../FunctionEditor.js';
import {shouldHappen} from '@ticlo/core/util/test-util.js';
import {blankFuncDesc, blankPropDesc, PropDesc} from '@ticlo/core';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.js';
import {Root} from '@ticlo/core';
import {DateEditor} from '../DateEditor.js';

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
    simulate(div.querySelector('.anticon-down'), 'click');
    await shouldHappen(() => querySingle("//div.ticl-tree-type/span[text()='math']", document.body));

    simulate(querySingle("//div.ticl-tree-type/span[text()='math']/../div.ticl-tree-arr", document.body), 'click');

    await shouldHappen(() => querySingle("//div.ticl-func-view/span[text()='add']", document.body));

    simulate(querySingle("//div.ticl-func-view/span[text()='add']/..", document.body), 'click');

    await shouldHappen(() => value === 'add');

    client.destroy();
  });
});
