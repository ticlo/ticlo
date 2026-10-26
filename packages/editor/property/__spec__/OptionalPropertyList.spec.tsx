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

  it('enables the matching property on Enter', async () => {
    const name = 'background';
    await userEvent.fill(input, 'BACKGROUND');
    await userEvent.keyboard('{Enter}');
    await shouldHappen(
      () =>
        input.value === '' &&
        names()[0] === name &&
        div.querySelector<HTMLInputElement>('.ticl-e-property-optional input[type="checkbox"]')?.checked
    );
    expect(Root.instance.queryValue('OptionalPropertySearch.style.#optional')).toEqual([name]);
    expect(div.querySelector<HTMLInputElement>('.ticl-e-property-optional input[type="checkbox"]').checked).toBe(true);
    expect(list.history.entries[0]).toEqual({name, count: 1});
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

  it('keeps selection unchanged when Enter has no matching property', async () => {
    const search = 'missingProperty';
    await userEvent.fill(input, search);
    await userEvent.keyboard('{Enter}');
    expect(Root.instance.queryValue('OptionalPropertySearch.style.#optional')).toBeUndefined();
    expect(input.value).toBe(search);
  });
});
