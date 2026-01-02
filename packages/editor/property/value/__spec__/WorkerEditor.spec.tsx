import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle, expandDocumentBody} from '../../../util/test-util.js';
import {initEditor} from '../../../index.js';
import {WorkerEditor} from '../WorkerEditor.js';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.js';
import {blankFuncDesc, blankPropDesc, PropDesc} from '@ticlo/core';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.js';
import {Root} from '@ticlo/core';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.js';
import {globalFunctions} from '@ticlo/core/block/Functions.js';
import {DateEditor} from '../DateEditor.js';

describe('WorkerEditor', function () {
  beforeEach(async function () {
    expandDocumentBody();
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('expand type editor', async function () {
    WorkerFunctionGen.registerType({'#is': ''}, {name: 'class1'}, 'WorkerEditor');

    const [server, client] = makeLocalConnection(Root.instance, true);

    let value: string = null;
    const onChange = (v: string) => {
      value = v;
    };
    const desc: PropDesc = {name: '', type: 'type'};
    const [component, div] = loadTemplate(
      <WorkerEditor value="" conn={client} funcDesc={blankFuncDesc} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.anticon-down'));
    simulate(div.querySelector('.anticon-down'), 'click');

    await shouldHappen(() => querySingle("//div.ticl-tree-type/span[text()='WorkerEditor']", document.body));

    window.onerror = function (e) {};
    simulate(
      querySingle("//div.ticl-tree-type/span[text()='WorkerEditor']/../div.ticl-tree-arr", document.body),
      'click'
    );

    await shouldHappen(() => querySingle("//div.ticl-func-view/span[text()='class1']", document.body));

    simulate(querySingle("//div.ticl-func-view/span[text()='class1']/..", document.body), 'click');

    await shouldHappen(() => value === 'WorkerEditor:class1');

    client.destroy();

    globalFunctions.clear('WorkerEditor:class1');
  });
});
