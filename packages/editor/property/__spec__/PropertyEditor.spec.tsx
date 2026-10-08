import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import '../../index.ts';
import {PropertyEditor} from '../PropertyEditor.tsx';
import {Block, Root} from '@ticlo/core';
import {PropertyList} from '../PropertyList.tsx';
import '../../../core/functions/math/Arithmetic.ts';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen, shouldReject} from '@ticlo/core/util/test-util.ts';
import {removeLastTemplate, loadTemplate, querySingle} from '../../util/test-util.ts';
import {initEditor} from '../../index.ts';
import type {PropGroupDesc} from '@ticlo/core';
import {FunctionDesc, PropDesc} from '@ticlo/core';
import {globalFunctions} from '@ticlo/core/block/FunctionLib.ts';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';

describe('PropertyEditor', function () {
  const [funcDesc] = globalFunctions.getDescToSend('add');
  const propDesc = (funcDesc.properties[0] as PropGroupDesc).properties[0];

  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
    destroyLastLocalConnection();
  });

  it.each(['@d-lock', '@d-seal', {name: '@test-lock', type: 'toggle', default: false}] as (string | PropDesc)[])(
    'edits named and custom Block attributes through the generic attribute panel (%j)',
    async function (attribute) {
      const id = 'test-attribute';
      const name = typeof attribute === 'string' ? attribute : attribute.name;
      globalFunctions.addFactory(null, {
        name: id,
        attributes: [attribute],
      });
      const flow = Root.instance.addFlow('PropertyAttributeTest', {block: {'#is': id}});
      const [, conn] = makeLocalConnection(Root.instance);
      let list: PropertyList;
      const [, div] = loadTemplate(
        <PropertyList
          ref={(value) => {
            list = value;
          }}
          conn={conn}
          paths={['PropertyAttributeTest.block']}
        />
      );
      await shouldHappen(() => list && div.querySelector('.ticl-e-property-divider'));
      list.onShowAttributeClick();
      await shouldHappen(() => div.textContent.includes(name));
      await shouldHappen(() => div.querySelector('.ant-switch'));
      const toggle = div.querySelector<HTMLElement>('.ant-switch');
      toggle.click();
      await shouldHappen(() => (flow.getValue('block') as Block).getValue(name) === true);
      globalFunctions.delete(id);
      Root.instance.deleteValue('PropertyAttributeTest');
    }
  );

  it('editable', async function () {
    const flow = Root.instance.addFlow('PropertyEditor1');
    flow.load({
      add1: {
        '#is': 'add',
        '0': 1,
      },
      add2: {
        '#is': 'add',
        '0': 1,
      },
    });

    const [server, client] = makeLocalConnection(Root.instance, true);

    const [component, div] = loadTemplate(
      <PropertyEditor
        conn={client}
        paths={['PropertyEditor1.add1', 'PropertyEditor1.add2']}
        name="0"
        funcDesc={funcDesc}
        propDesc={propDesc}
      />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-number-input'));
    const input = div.querySelector('.ticl-e-number-input');

    // value is editable when value is same
    expect(input.classList.contains('ticl-e-number-input-disabled')).toBe(false);

    // value is not editable when value is different
    flow.queryProperty('add1.0').setValue(2);
    await shouldHappen(() => input.classList.contains('ticl-e-number-input-disabled'));

    flow.queryProperty('add1.0').setValue(undefined);
    flow.queryProperty('add2.0').setValue(undefined);
    await shouldHappen(() => !input.classList.contains('ticl-e-number-input-disabled'));

    // value is not editable when there is a binding
    flow.queryProperty('add1.0').setBinding('1');
    await shouldHappen(() => input.classList.contains('ticl-e-number-input-disabled'));

    Root.instance.deleteValue('PropertyEditor1');
  });

  it('subblock', async function () {
    const flow = Root.instance.addFlow('PropertyEditor2');
    flow.load({
      add1: {
        '#is': 'add',
        '~0': {'#is': 'add'},
      },
      add2: {
        '#is': 'add',
        '~0': {'#is': 'add'},
      },
    });

    const [server, client] = makeLocalConnection(Root.instance, true);

    const [component, div] = loadTemplate(
      <PropertyEditor
        conn={client}
        paths={['PropertyEditor2.add1', 'PropertyEditor2.add2']}
        name="0"
        funcDesc={funcDesc}
        propDesc={propDesc}
      />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-number-input'));
    const input = div.querySelector('.ticl-e-number-input');

    const expandIcon = div.querySelector('.ticl-e-tree-arr-expand');

    expect(expandIcon).not.toBeNull();
    expect(div.querySelector('.ticl-e-property-list')).toBeNull();

    // subblock should expand
    simulate(expandIcon, 'click');
    await shouldHappen(() => div.querySelector('.ticl-e-property-list'));
    // find the child property group for [] 0 1
    await shouldHappen(() => div.querySelector('.ticl-e-property-group'));

    Root.instance.deleteValue('PropertyEditor2');
  });

  it('uses funcLib for in-flow function descriptors', async function () {
    const flow = Root.instance.addFlow('PropertyEditorScopedDesc', {});
    const data = {
      '#is': '',
      '#inputs': {'#is': '', '#custom': [{name: 'value', type: 'number'}]},
      '#outputs': {'#is': ''},
    };
    WorkerFunctionGen.registerType(data, {id: ':scopedWorker', name: 'scopedWorker'}, undefined, flow.getFuncLib());
    flow.createBlock('calc').setValue('#is', ':scopedWorker');

    const [server, client] = makeLocalConnection(Root.instance, true);

    const [component, div] = loadTemplate(
      <PropertyList
        conn={client}
        paths={['PropertyEditorScopedDesc.calc']}
        funcLib="PropertyEditorScopedDesc"
        style={{width: 300, height: 300}}
      />,
      'editor'
    );

    await shouldHappen(() => querySingle("//div[contains(@class,'ticl-e-property-name')]/span[text()='value']", div));

    Root.instance.deleteValue('PropertyEditorScopedDesc');
  });

  it('reorders custom properties with the right button without opening a menu', async () => {
    const flow = Root.instance.addFlow('PropertyEditorReorderMenu', {
      block: {
        '#is': '',
        '#custom': [
          {name: 'a', type: 'number'},
          {name: 'b', type: 'number'},
        ],
        'a': 1,
        'b': 2,
      },
    });
    const [, client] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(
      <PropertyList conn={client} paths={['PropertyEditorReorderMenu.block']} style={{width: 300, height: 300}} />,
      'editor'
    );
    try {
      const source = await shouldHappen(() =>
        querySingle("//div.ticl-e-property-name.drag-initiator/span[text()='a']/..", div)
      );
      const target = await shouldHappen(() =>
        querySingle("//div.ticl-e-property-name.drag-initiator/span[text()='b']/..", div)
      );
      const from = source.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const down = {button: 2, buttons: 2, clientX: from.x + from.width / 2, clientY: from.y + from.height / 2};
      const move = {button: 2, buttons: 2, clientX: to.x + to.width / 2, clientY: to.y + to.height / 2};
      simulate(source, 'mousedown', down);
      simulate(source, 'contextmenu', down);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)')).toBeNull();
      simulate(target, 'mousemove', move);
      simulate(target, 'mouseup', {...move, buttons: 0});
      simulate(target, 'contextmenu', {...move, buttons: 0});
      await shouldHappen(() => (flow.queryValue('block.#custom') as PropDesc[])[0].name === 'b');
      expect((flow.queryValue('block.#custom') as PropDesc[]).map((prop) => prop.name)).toEqual(['b', 'a']);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)')).toBeNull();

      // A later context-menu request still opens normally, including keyboard requests.
      simulate(source, 'contextmenu', down);
      await shouldHappen(() => document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)'));
    } finally {
      Root.instance.deleteValue('PropertyEditorReorderMenu');
    }
  });
});
