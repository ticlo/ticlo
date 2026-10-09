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

describe('OptionalPropertyList search', () => {
  let div: HTMLDivElement;
  let input: HTMLInputElement;
  const names = () =>
    Array.from(div.querySelectorAll('.ticl-e-property-optional .ticl-e-property-name')).map(
      (element) => element.textContent
    );

  beforeEach(async () => {
    await initEditor();
    Root.instance.addFlow('OptionalPropertySearch', {style: {'#is': 'html:create-style'}});
    const [, conn] = makeLocalConnection(Root.instance);
    const [funcDesc] = globalFunctions.getDescToSend('html:create-style');
    [, div] = loadTemplate(
      <OptionalPropertyList conn={conn} paths={['OptionalPropertySearch.style']} funcDesc={funcDesc} />,
      'editor'
    );
    const button = await shouldHappen(() => div.querySelector<HTMLButtonElement>('.ticl-e-property-divider button'));
    button.click();
    input = await shouldHappen(() => div.querySelector<HTMLInputElement>('.ticl-e-property-divider input'));
  });

  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue('OptionalPropertySearch');
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
    await shouldHappen(() => input.value === '' && names().length === 1);
    expect(Root.instance.queryValue('OptionalPropertySearch.style.#optional')).toEqual([name]);
    expect(names()).toEqual([name]);
    expect(div.querySelector<HTMLInputElement>('.ticl-e-property-optional input[type="checkbox"]').checked).toBe(true);
  });

  it.each(['backgroun', 'missingProperty', ''])('keeps selection unchanged on Enter for %j', async (search) => {
    await userEvent.fill(input, search);
    await userEvent.keyboard('{Enter}');
    expect(Root.instance.queryValue('OptionalPropertySearch.style.#optional')).toBeUndefined();
    expect(input.value).toBe(search);
  });
});
