import React from 'react';
import {page, userEvent} from 'vitest/browser';
import {Block, Root, blankFuncDesc, type PropDesc} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../../util/test-util.ts';
import {PropertyEditor} from '../../PropertyEditor.tsx';
import {EditPolicyProvider} from '../../../component/EditPolicyContext.tsx';
import {requestCallbacks} from '../../../util/RequestCallbacks.ts';
import '@ticlo/html/functions/CreateStyle.ts';

const propDesc: PropDesc = {name: 'style', type: 'object', create: 'html:create-style'};
const tool = () => document.querySelector<HTMLElement>('.ticl-e-object-convert-button');

async function convert(title: string) {
  await userEvent.click(tool());
  await page.getByText(title, {exact: true}).click();
}

describe('ObjectEditor conversion', () => {
  beforeEach(async () => {
    await initEditor();
  });

  afterEach(async () => {
    removeLastTemplate();
    await waitTick(30);
    destroyLastLocalConnection();
    Root.instance.deleteValue('ObjectEditorTest');
    vi.restoreAllMocks();
  });

  it('round-trips each selected block with one full read and one write per block', async () => {
    const first = {color: 'red', width: 12, extra: 'x'.repeat(3000)};
    const second = {color: 'blue', height: 24, extra: 'y'.repeat(3000)};
    const flow = Root.instance.addFlow('ObjectEditorTest', {
      first: {'#is': '', 'style': first},
      second: {'#is': '', 'style': second},
    });
    const [, conn] = makeLocalConnection(Root.instance, true);
    loadTemplate(
      <PropertyEditor
        conn={conn}
        paths={['ObjectEditorTest.first', 'ObjectEditorTest.second']}
        name="style"
        funcDesc={blankFuncDesc}
        propDesc={propDesc}
      />,
      'editor'
    );
    await shouldHappen(() => tool());
    const get = vi.spyOn(conn, 'getValue');
    const add = vi.spyOn(conn, 'addBlock');
    const set = vi.spyOn(conn, 'setValue');
    await userEvent.click(tool());
    expect(get).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    await page.getByText('Convert to html:create-style', {exact: true}).click();
    await shouldHappen(() => tool() && flow.queryProperty('second.style')._bindingPath === '~style.#output');
    expect(get.mock.calls.filter(([path]) => path.endsWith('.style'))).toEqual([
      ['ObjectEditorTest.first.style'],
      ['ObjectEditorTest.second.style'],
    ]);
    await shouldHappen(() => document.querySelector('.ticl-e-property-list .ticl-e-type-editor'));
    expect(add).toHaveBeenCalledTimes(2);
    expect(set).not.toHaveBeenCalled();
    for (const [name, value] of [
      ['first', first],
      ['second', second],
    ] as const) {
      const helper = flow.queryValue(`${name}.~style`) as Block;
      expect(helper.getValue('#is')).toBe('html:create-style');
      expect(helper.getValue('#optional')).toEqual(Object.keys(value).filter((name) => name !== 'extra'));
      expect(helper.getValue('+extend')).toEqual({extra: value.extra});
      expect(flow.queryValue(`${name}.style`)).toEqual(value);
      expect(flow.queryProperty(`${name}.style`)._bindingPath).toBe('~style.#output');
    }
    const helper = flow.queryValue('first.~style') as Block;
    helper.setValue('color', 'green');
    await shouldHappen(() => (flow.queryValue('first.style') as typeof first).color === 'green');
    await waitTick(30);
    get.mockClear();
    add.mockClear();
    await convert('Convert to object value');
    await shouldHappen(() => tool() && flow.queryProperty('second.style')._bindingPath == null);
    expect(get.mock.calls).toEqual([['ObjectEditorTest.first.style'], ['ObjectEditorTest.second.style']]);
    expect(set.mock.calls).toEqual([
      ['ObjectEditorTest.first.style', {...first, color: 'green'}, true],
      ['ObjectEditorTest.second.style', second, true],
    ]);
    expect(add).not.toHaveBeenCalled();
    expect(helper._destroyed).toBe(true);
    expect(flow.queryValue('first.~style')).toBeUndefined();
    expect(flow.queryValue('second.~style')).toBeUndefined();
    expect(flow.queryProperty('first.style')._bindingPath).toBeNull();
    expect(document.querySelector('.ticl-e-property-list')).toBeNull();
    expect(flow.save()).toEqual({
      '#is': '',
      'first': {'#is': '', 'style': {...first, color: 'green'}},
      'second': {'#is': '', 'style': second},
    });
  });

  it('initializes custom object fields and preserves nested values containing #is', async () => {
    const value = {'label': 'before', 'nested': {'#is': 'plain data'}, '#is': 'also plain data'};
    const flow = Root.instance.addFlow('ObjectEditorTest', {block: {'#is': '', 'style': {'#is': value}}});
    const [, conn] = makeLocalConnection(Root.instance, true);
    loadTemplate(
      <PropertyEditor
        conn={conn}
        paths={['ObjectEditorTest.block']}
        name="style"
        funcDesc={blankFuncDesc}
        propDesc={{...propDesc, create: 'create-object'}}
      />,
      'editor'
    );
    await shouldHappen(() => tool());
    await convert('Convert to create-object');
    await shouldHappen(() => tool() && flow.queryProperty('block.style')._bindingPath === '~style.#output');
    await shouldHappen(() => document.querySelector('.ticl-e-property-list .ticl-e-type-editor'));
    const helper = flow.queryValue('block.~style') as Block;
    expect(helper.getValue('#custom')).toEqual([
      {name: 'label', type: 'any'},
      {name: 'nested', type: 'any'},
    ]);
    expect(helper.getValue('nested')).toEqual(value.nested);
    expect(flow.queryValue('block.style')).toEqual(value);
    await convert('Convert to object value');
    await shouldHappen(() => tool() && flow.queryProperty('block.style')._bindingPath == null);
    expect(flow.save()).toEqual({'#is': '', 'block': {'#is': '', 'style': {'#is': value}}});
  });

  it('updates the tool when the helper function changes and honors edit policies', async () => {
    const flow = Root.instance.addFlow('ObjectEditorTest', {
      block: {'#is': '', '~style': {'#is': 'create-object', '+extend': {color: 'red'}}},
    });
    const [server, conn] = makeLocalConnection(Root.instance, true);
    loadTemplate(
      <EditPolicyProvider conn={conn}>
        <PropertyEditor
          conn={conn}
          paths={['ObjectEditorTest.block']}
          name="style"
          funcDesc={blankFuncDesc}
          propDesc={propDesc}
        />
      </EditPolicyProvider>,
      'editor'
    );
    await shouldHappen(() => document.querySelector('.ticl-e-object-editor'));
    expect(tool()).toBeNull();
    (flow.queryValue('block.~style') as Block).setValue('#is', 'html:create-style');
    await shouldHappen(() => tool());
    server.setEditPolicy({allowDeleteBlock: false});
    await shouldHappen(() => !tool());
    server.setEditPolicy({readonly: true});
    await shouldHappen(() => document.querySelector('.ticl-e-property-readonly'));
    expect(tool()).toBeNull();
    server.setEditPolicy({});
    await shouldHappen(() => tool());
  });

  it('leaves the current value untouched if the full read fails', async () => {
    const value = {color: 'red'};
    const flow = Root.instance.addFlow('ObjectEditorTest', {block: {'#is': '', 'style': value}});
    const [, conn] = makeLocalConnection(Root.instance, true);
    loadTemplate(
      <PropertyEditor
        conn={conn}
        paths={['ObjectEditorTest.block']}
        name="style"
        funcDesc={blankFuncDesc}
        propDesc={propDesc}
      />,
      'editor'
    );
    await shouldHappen(() => tool());
    vi.spyOn(conn, 'getValue').mockRejectedValueOnce('read failed');
    const error = vi.spyOn(requestCallbacks, 'onError').mockImplementation(() => {});
    const add = vi.spyOn(conn, 'addBlock');
    await convert('Convert to html:create-style');
    await shouldHappen(() => error.mock.calls.length === 1);
    expect(add).not.toHaveBeenCalled();
    expect(flow.queryValue('block.style')).toEqual(value);
    expect(flow.queryValue('block.~style')).toBeUndefined();
    expect(document.querySelector('.ticl-e-property-list')).toBeNull();
  });
});
