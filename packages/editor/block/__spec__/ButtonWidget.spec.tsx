import React from 'react';
import {Block, Root, type ClientConn, type Flow} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {EditPolicyProvider} from '../../component/EditPolicyContext.tsx';
import {initEditor} from '../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {BlockStage} from '../BlockStage.tsx';

describe('button block widget', () => {
  let flow: Flow;
  let block: Block;
  let client: ClientConn;

  beforeEach(async () => {
    await initEditor();
    flow = Root.instance.addFlow('ButtonWidget', {
      block: {
        '#is': 'add',
        '#mode': 'onCall',
        '0': 1,
        '1': 2,
        '@b-xyw': [100, 100, 200],
        '@b-widget': 'button',
      },
    });
    block = flow.getValue('block') as Block;
  });

  afterEach(async () => {
    await client.getValue('ButtonWidget.block');
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue('ButtonWidget');
  });

  it('calls the function and keeps field bindings aligned', async () => {
    block.setValue('@b-p', ['0', '1', '#output']);
    [, client] = makeLocalConnection(Root.instance);
    const stage = React.createRef<BlockStage>();
    const [, div] = loadTemplate(<BlockStage ref={stage} conn={client} basePath="ButtonWidget" />, 'editor');
    const button = () => div.querySelector('.ticl-e-block-view button') as HTMLButtonElement;
    await shouldHappen(button);
    expect(block.getValue('#output')).toBeUndefined();

    const view = div.querySelector('.ticl-e-block-view') as HTMLElement;
    const field = div.querySelector('.ticl-e-block-body > .ticl-e-field') as HTMLElement;
    const item = stage.current.getBlock('ButtonWidget.block');
    await shouldHappen(() => field?.offsetHeight > 0 && item.viewH === view.offsetHeight);
    const fieldRect = field.getBoundingClientRect();
    const blockRect = view.closest('.ticl-e-block').getBoundingClientRect();
    expect(fieldRect.top + fieldRect.height / 2 - blockRect.top).toBe(item.fieldItems.get('0').y - item.y);

    button().click();
    await shouldHappen(() => block.getValue('#output') === 3);

    block.setValue('0', 4);
    button().click();
    await shouldHappen(() => block.getValue('#output') === 6);
  });

  it.each([true, false])('updates fields with fresh objects when serialize=%s', async (serialize) => {
    block.setValue('@b-w-field', 'trigger');
    block.setValue('trigger', {saved: true});
    [, client] = makeLocalConnection(Root.instance, true, undefined, serialize);
    const [, div] = loadTemplate(<BlockStage conn={client} basePath="ButtonWidget" />, 'editor');
    const button = () => div.querySelector('.ticl-e-block-view button') as HTMLButtonElement;
    await shouldHappen(() => button()?.textContent === 'trigger');

    const updates: any[] = [];
    block.getProperty('trigger').listen({
      onSourceChange() {},
      onChange(value) {
        updates.push(value);
      },
    });
    updates.length = 0;
    button().click();
    await shouldHappen(() => updates.length === 1);
    button().click();
    await shouldHappen(() => updates.length === 2);
    expect(updates).toEqual([{}, {}]);
    expect(updates[0]).not.toBe(updates[1]);
    expect(block.getProperty('trigger')._saved).toEqual({saved: true});
    expect(block.getValue('#output')).toBeUndefined();

    const payload = {nested: {items: Array.from({length: 200}, (_, index) => ({index}))}};
    await client.setValue('ButtonWidget.block.@b-w-value', payload, true);
    await client.setValue('ButtonWidget.block.@b-w-label', 'Send', true);
    await shouldHappen(() => button().textContent === 'Send');
    button().click();
    await shouldHappen(() => updates.length === 3);
    expect(updates[2]).toEqual(payload);
    expect(updates[2]).not.toBe(block.getValue('@b-w-value'));
    expect(updates[2].nested).not.toBe((block.getValue('@b-w-value') as typeof payload).nested);
    updates[2].nested.items[0].index = -1;

    button().click();
    await shouldHappen(() => updates.length === 4);
    expect(updates[3]).toEqual(payload);
    expect(updates[3]).not.toBe(updates[2]);
    expect(updates[3].nested.items).not.toBe(updates[2].nested.items);
    expect(block.getValue('@b-w-value')).toEqual(payload);
    expect(block.getProperty('trigger')._saved).toEqual({saved: true});

    await client.setValue('ButtonWidget.block.@b-w-field', 'other', true);
    await client.setValue('ButtonWidget.block.@b-w-label', undefined, true);
    await shouldHappen(() => button().textContent === 'other');
    button().click();
    await shouldHappen(() => block.getValue('other') != null);
    expect(block.getValue('other')).toEqual(payload);
    expect(updates).toHaveLength(4);
  });

  it.each([
    ['callFunction', undefined],
    ['update', 'trigger'],
  ])('respects the %s edit policy', async (command, field) => {
    block.setValue('@b-w-field', field);
    const [server, conn] = makeLocalConnection(Root.instance, true, {denyCmds: [command]});
    client = conn;
    const [, div] = loadTemplate(
      <EditPolicyProvider conn={client}>
        <BlockStage conn={client} basePath="ButtonWidget" />
      </EditPolicyProvider>,
      'editor'
    );
    const button = () => div.querySelector('.ticl-e-block-view button') as HTMLButtonElement;
    await shouldHappen(() => button()?.disabled);
    button().click();
    expect(block.getValue('#output')).toBeUndefined();
    expect(block.getValue('trigger')).toBeUndefined();

    server.setEditPolicy(undefined);
    await shouldHappen(() => !button().disabled);
    button().click();
    await shouldHappen(() => (field ? block.getValue(field) != null : block.getValue('#output') === 3));
  });
});
