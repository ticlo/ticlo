import React from 'react';
import {simulate} from 'simulate-event';
import {Root, type Block, type ClientConn, type Flow, type PropDesc, type PropGroupDesc} from '@ticlo/core';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {PropertyList} from '../PropertyList.tsx';

describe('Copy Type menu', () => {
  let flow: Flow;
  let block: Block;
  const source: PropDesc = {name: 'source', type: 'number', min: 1, max: 10};

  beforeEach(async () => {
    await initEditor();
    flow = Root.instance.addFlow('CopyDescriptorMenu', {
      block: {'#is': '', '#custom': [{name: 'value', type: 'any'}, source], 'source': 3},
    });
    block = flow.getValue('block') as Block;
  });

  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue('CopyDescriptorMenu');
  });

  const menu = () => document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)');
  const copyButton = () =>
    Array.from(menu()?.querySelectorAll('button') ?? []).find((button) => button.textContent === 'Copy Type');

  async function copyDescriptor(conn: ClientConn) {
    const request = vi.spyOn(conn, 'copyCustomPropDesc');
    copyButton().click();
    expect(request).toHaveBeenCalledTimes(1);
    await request.mock.results[0].value;
    request.mockRestore();
  }

  async function openMenu(div: HTMLDivElement, name: string) {
    let property: Element;
    await shouldHappen(() => {
      property = Array.from(div.querySelectorAll('.ticl-e-property-name.drag-initiator')).find(
        (element) => element.textContent === name
      );
      return property;
    });
    simulate(property, 'contextmenu', {button: 2, buttons: 0});
    await shouldHappen(menu);
  }

  it('copies from a binding source and refreshes the property editor', async () => {
    block.setBinding('value', 'source');
    const [, conn] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(<PropertyList conn={conn} paths={['CopyDescriptorMenu.block']} />, 'editor');
    await openMenu(div, 'value');
    await shouldHappen(copyButton);
    await copyDescriptor(conn);
    await shouldHappen(() => (flow.queryValue('block.#custom') as PropDesc[])[0].type === 'number');
    await shouldHappen(() => div.querySelectorAll('.ticl-e-number-input').length === 2);
    expect((flow.queryValue('block.#custom') as PropDesc[])[0]).toEqual({...source, name: 'value'});
  });

  it('updates the menu when a binding target is added or removed without changing the value', async () => {
    block.setValue('value', 3);
    const [, conn] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(<PropertyList conn={conn} paths={['CopyDescriptorMenu.block']} />, 'editor');
    await openMenu(div, 'value');
    expect(copyButton()).toBeUndefined();
    await conn.addBlock('CopyDescriptorMenu.target', {'#is': 'add', '~0': '##.block.value'});
    await shouldHappen(copyButton);
    flow.queryProperty('target.0').setBinding(null);
    await shouldHappen(() => !copyButton());
    flow.queryProperty('target.0').setBinding('##.block.value');
    await shouldHappen(copyButton);
    await copyDescriptor(conn);
    await shouldHappen(() => (flow.queryValue('block.#custom') as PropDesc[])[0].type === 'number');
  });

  it('updates every indexed child with the same base name in a custom group', async () => {
    const group: PropGroupDesc = {
      name: 'items',
      type: 'group',
      defaultLen: 2,
      properties: [{name: 'item', type: 'any'}],
    };
    block.setValue('#custom', [group, source]);
    block.setBinding('item1', 'source');
    const [, conn] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(<PropertyList conn={conn} paths={['CopyDescriptorMenu.block']} />, 'editor');
    await openMenu(div, 'item1');
    await shouldHappen(copyButton);
    await copyDescriptor(conn);
    await shouldHappen(() => div.querySelectorAll('.ticl-e-number-input').length === 4);
    expect((block.getValue('#custom') as PropGroupDesc[])[0].properties).toEqual([{...source, name: 'item'}]);
  });

  it.each(['multiple selection', 'group header', 'built-in property'])('hides the action for %s', async (scenario) => {
    const [, conn] = makeLocalConnection(Root.instance);
    let name = 'value';
    let paths = ['CopyDescriptorMenu.block'];
    if (scenario === 'multiple selection') {
      block.setBinding('value', 'source');
      await conn.addBlock('CopyDescriptorMenu.other', block._save());
      paths.push('CopyDescriptorMenu.other');
    } else if (scenario === 'group header') {
      name = 'items[]';
      block.setValue('#custom', [{name: 'items', type: 'group', defaultLen: 2, properties: []}, source]);
      block.setBinding(name, 'source');
    } else {
      name = '0';
      block.setValue('#is', 'add');
      block.setBinding(name, 'source');
    }
    const [, div] = loadTemplate(<PropertyList conn={conn} paths={paths} />, 'editor');
    await openMenu(div, name);
    expect(copyButton()).toBeUndefined();
  });
});
