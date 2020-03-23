import {assert} from 'chai';
import SimulateEvent from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle, expandDocumentBody} from '../../../util/test-util';
import {initEditor} from '../../../index';
import {WorkerEditor} from '../WorkerEditor';
import {shouldHappen, waitTick} from '../../../../core/util/test-util';
import {blankPropDesc, PropDesc} from '../../../../../src/core/editor';
import {makeLocalConnection} from '../../../../core/connect/LocalConnection';
import {Root} from '../../../../../src/core';
import {WorkerFunction} from '../../../../core/worker/WorkerFunction';
import {Functions} from '../../../../core/block/Functions';

describe('WorkerEditor', function () {
  beforeEach(async function () {
    expandDocumentBody();
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
  });

  it('expand type editor', async function () {
    WorkerFunction.registerType({'#is': ''}, {name: 'class1'}, 'WorkerEditor');

    let [server, client] = makeLocalConnection(Root.instance, true);

    let value: string = null;
    let onChange = (v: string) => {
      value = v;
    };
    let desc: PropDesc = {name: '', type: 'type'};
    let [component, div] = loadTemplate(
      <WorkerEditor value="" conn={client} desc={desc} onChange={onChange} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.anticon-down'));
    SimulateEvent.simulate(div.querySelector('.anticon-down'), 'click');

    await shouldHappen(() => querySingle("//div.ticl-tree-type/span[text()='WorkerEditor']", document.body));

    window.onerror = function (e) {};
    SimulateEvent.simulate(
      querySingle("//div.ticl-tree-type/span[text()='WorkerEditor']/../div.ticl-tree-arr", document.body),
      'click'
    );

    await shouldHappen(() => querySingle("//div.ticl-func-view/span[text()='class1']", document.body));

    SimulateEvent.simulate(querySingle("//div.ticl-func-view/span[text()='class1']/..", document.body), 'click');

    await shouldHappen(() => value === 'WorkerEditor:class1');

    client.destroy();

    Functions.clear('WorkerEditor:class1');
  });
});
