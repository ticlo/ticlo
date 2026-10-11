import React from 'react';
import {userEvent} from 'vitest/browser';
import {Root} from '@ticlo/core';
import {globalFunctions} from '@ticlo/core/block/FunctionLib.ts';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import '../../../html/functions/CreateStyle.ts';
import {initEditor} from '../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {OptionalPropertyList} from '../OptionalPropertyList.tsx';
import {OptionalPropertyHistory} from '../OptionalPropertyHistory.ts';

describe('OptionalPropertyList search', () => {
  let div: HTMLDivElement;
  let input: HTMLInputElement;
  let list: OptionalPropertyList;
  let historyKey: string;
  const names = () =>
    Array.from(div.querySelectorAll('.ticl-e-property-optional .ticl-e-property-name')).map(
      (element) => element.textContent
    );

  beforeEach(async () => {
    await initEditor();
    Root.instance.addFlow('OptionalPropertySearch', {
      style: {'#is': 'html:create-style'},
      style2: {'#is': 'html:create-style'},
    });
    const [, conn] = makeLocalConnection(Root.instance);
    const [funcDesc] = globalFunctions.getDescToSend('html:create-style');
    historyKey = new OptionalPropertyHistory(funcDesc, funcDesc.optional).storageKey;
    localStorage.removeItem(historyKey);
    [, div] = loadTemplate(
      <OptionalPropertyList
        ref={(component) => {
          list = component;
        }}
        conn={conn}
        paths={['OptionalPropertySearch.style']}
        funcDesc={funcDesc}
      />,
      'editor'
    );
    await expect
      .poll(
        () =>
          list?.loaders.size === 1 && [...list.loaders.values()].every((loader) => loader.optionalProps !== undefined),
        {timeout: 5000}
      )
      .toBe(true);
    const button = await shouldHappen(() => div.querySelector<HTMLButtonElement>('.ticl-e-property-divider button'));
    button.click();
    input = await shouldHappen(() => div.querySelector<HTMLInputElement>('.ticl-e-property-divider input'));
  });

  afterEach(async () => {
    await list.props.conn.getValue('OptionalPropertySearch.style.#optional');
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue('OptionalPropertySearch');
    localStorage.removeItem(historyKey);
  });

  it('shows descriptor suggestions for a focused empty search and restores them after clearing text', async () => {
    await shouldHappen(() => names().length === 10);
    expect(document.activeElement).toBe(input);
    expect(names()).toEqual([
      'display',
      'width',
      'height',
      'color',
      'backgroundColor',
      'margin',
      'padding',
      'fontSize',
      'border',
      'position',
    ]);
    await userEvent.fill(input, 'missingProperty');
    await shouldHappen(() => names().length === 0);
    await userEvent.fill(input, '');
    await shouldHappen(() => names().length === 10);
    expect(names()[0]).toBe('display');
  });

  it('sorts background before its longer names before applying the result limit', async () => {
    await userEvent.fill(input, 'backgroun');
    await shouldHappen(() => names()[0] === 'background');
    expect(names().slice(0, 3)).toEqual(['background', 'backgroundAttachment', 'backgroundBlendMode']);
    expect(names()).toHaveLength(10);
    expect(div.textContent).toContain('. . . more . . .');

    await userEvent.fill(input, 'background');
    expect(names()[0]).toBe('background');
  });

  it('sorts matches alphabetically with case-insensitive prefix matches first', async () => {
    await userEvent.fill(input, 'COLOR');
    await shouldHappen(() => names()[0] === 'color');
    expect(names().slice(0, 4)).toEqual(['color', 'colorAdjust', 'colorInterpolation', 'colorRendering']);
    expect(names()[4]).toBe('backgroundColor');
  });

  it.each([
    {search: 'background', name: 'background'},
    {search: 'BACKGROUND', name: 'background'},
    {search: 'backgroundatta', name: 'backgroundAttachment'},
  ])('enables $name on Enter when searching for $search', async ({search, name}) => {
    await userEvent.fill(input, search);
    await userEvent.keyboard('{Enter}');
    await shouldHappen(
      () =>
        input.value === '' &&
        names()[0] === name &&
        div.querySelector<HTMLInputElement>('.ticl-e-property-optional input[type="checkbox"]')?.checked
    );
    expect(Root.instance.queryValue('OptionalPropertySearch.style.#optional')).toEqual([name]);
    expect(names()).toHaveLength(10);
    expect(div.querySelector<HTMLInputElement>('.ticl-e-property-optional input[type="checkbox"]').checked).toBe(true);
    expect(list.history.entries[0]).toEqual({name, count: 1});
  });

  it('records checkbox enables once per action and retains history after disabling', async () => {
    await shouldHappen(() => names().length === 10);
    const checkbox = () => div.querySelector<HTMLInputElement>('.ticl-e-property-optional input[type="checkbox"]');
    const enabled = () =>
      (Root.instance.queryValue('OptionalPropertySearch.style.#optional') as string[])?.includes('display') === true;
    checkbox().click();
    await expect
      .poll(
        () => ({
          optional: Root.instance.queryValue('OptionalPropertySearch.style.#optional'),
          checked: checkbox()?.checked,
        }),
        {timeout: 5000}
      )
      .toEqual({optional: ['display'], checked: true});
    expect(list.history.entries[0]).toEqual({name: 'display', count: 2});
    checkbox().click();
    await expect.poll(() => !enabled() && !checkbox()?.checked, {timeout: 5000}).toBe(true);
    expect(list.history.entries[0]).toEqual({name: 'display', count: 2});
    checkbox().click();
    await expect.poll(() => enabled() && checkbox()?.checked, {timeout: 5000}).toBe(true);
    expect(list.history.entries[0]).toEqual({name: 'display', count: 3});
  });

  it('places matching enabled properties first, results and more before other enabled properties', async () => {
    list.onPropertyChecked('color', true);
    list.onPropertyChecked('backgroundColor', true);
    await shouldHappen(
      () => (Root.instance.queryValue('OptionalPropertySearch.style.#optional') as string[])?.length === 2
    );
    await userEvent.fill(input, 'backgroun');
    await shouldHappen(() => names()[0] === 'backgroundColor' && names().at(-1) === 'color');
    expect(names()[1]).toBe('background');
    expect(names().filter((name) => name === 'backgroundColor')).toHaveLength(1);
    const rows = Array.from(div.querySelector('.ticl-e-property-optional-list').children).map(
      (element) => element.textContent
    );
    expect(rows.findIndex((text) => text.includes('. . . more . . .'))).toBe(rows.length - 2);

    await userEvent.keyboard('{Escape}');
    await shouldHappen(() => !div.querySelector('.ticl-e-property-divider input'));
    expect(names()).toEqual(['color', 'backgroundColor']);
  });

  it('records one use when enabling across multiple selected blocks', async () => {
    const {conn, funcDesc} = list.props;
    removeLastTemplate();
    [, div] = loadTemplate(
      <OptionalPropertyList
        ref={(component) => {
          list = component;
        }}
        conn={conn}
        paths={['OptionalPropertySearch.style', 'OptionalPropertySearch.style2']}
        funcDesc={funcDesc}
      />
    );
    await shouldHappen(
      () => list?.loaders.size === 2 && [...list.loaders.values()].every((loader) => loader.optionalProps !== undefined)
    );
    list.onPropertyChecked('width', true);
    await shouldHappen(() =>
      (Root.instance.queryValue('OptionalPropertySearch.style2.#optional') as string[])?.includes('width')
    );
    expect(Root.instance.queryValue('OptionalPropertySearch.style.#optional')).toContain('width');
    expect(list.history.entries[0]).toEqual({name: 'width', count: 2});
  });

  it.each(['backgroun', 'missingProperty', ''])('keeps selection unchanged on Enter for %j', async (search) => {
    await userEvent.fill(input, search);
    await userEvent.keyboard('{Enter}');
    expect(Root.instance.queryValue('OptionalPropertySearch.style.#optional')).toBeUndefined();
    expect(input.value).toBe(search);
  });
});
