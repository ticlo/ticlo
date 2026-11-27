import {expect, vi} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import React from 'react';
import {Root, type Flow, type PropDesc, blankFuncDesc} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../../index.ts';
import {EditPolicyProvider} from '../../../component/EditPolicyContext.tsx';
import {expandDocumentBody, loadTemplate, removeLastTemplate} from '../../../util/test-util.ts';
import {ServiceEditor} from '../ServiceEditor.tsx';

function getDropdown(): HTMLElement {
  return document.body.querySelector<HTMLElement>('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
}

async function openSelect(container: HTMLElement): Promise<HTMLElement> {
  const select = await shouldHappen(() => {
    const el = container.querySelector<HTMLElement>('.ticl-e-service-editor .ant-select');
    return el && el.getBoundingClientRect().height > 0 ? el : null;
  });
  await userEvent.click(page.elementLocator(select));
  return shouldHappen(getDropdown);
}

describe('ServiceEditor', function () {
  const createdGlobals: string[] = [];

  beforeEach(async function () {
    expandDocumentBody();
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
    destroyLastLocalConnection();
    for (const name of createdGlobals.splice(0)) {
      Root.instance._globalRoot.deleteValue(name);
    }
    Root.instance.deleteValue('+ServiceEditorLib');
  });

  it('lists flow root, library #context, and #global scopes separated by dividers', async function () {
    const flow = Root.instance.addFlow('+ServiceEditorLib.mainFlow', undefined, undefined, true);
    const contextFlow = Root.instance.queryValue('+ServiceEditorLib.#context') as Flow;
    flow.createBlock('block').setValue('#is', 'add');
    flow.createBlock('^flow-http').setValue('#is', 'http:client');
    flow.createBlock('^shared-http').setValue('#is', 'http:client');
    contextFlow.createBlock('^context-http').setValue('#is', 'http:client');
    Root.instance._globalRoot.createBlock('^global-http').setValue('#is', 'http:client');
    Root.instance._globalRoot.createBlock('^shared-http').setValue('#is', 'http:client');
    createdGlobals.push('^global-http', '^shared-http');

    const [, conn] = makeLocalConnection(Root.instance);
    const onPathChange = vi.fn();
    const desc: PropDesc = {name: 'client', type: 'service', options: ['http-client']};

    const [, div] = loadTemplate(
      <EditPolicyProvider conn={conn}>
        <div style={{width: 240}}>
          <ServiceEditor
            conn={conn}
            keys={['+ServiceEditorLib.mainFlow.block']}
            value={undefined}
            bindingPath={null}
            funcDesc={blankFuncDesc}
            desc={desc}
            onPathChange={onPathChange}
          />
        </div>
      </EditPolicyProvider>,
      'editor'
    );

    const dropdown = await openSelect(div);
    await shouldHappen(() => dropdown.querySelectorAll('.ant-select-item-group').length === 3);

    const groups = [...dropdown.querySelectorAll<HTMLElement>('.ant-select-item-group')];
    expect(groups.map((group) => group.textContent)).toEqual(['mainFlow', '#context', '#global']);
    expect(groups[0].classList.contains('ticl-e-service-scope-divider')).toBe(false);
    expect(groups[1].classList.contains('ticl-e-service-scope-divider')).toBe(true);
    expect(groups[2].classList.contains('ticl-e-service-scope-divider')).toBe(true);

    const optionTexts = [...dropdown.querySelectorAll<HTMLElement>('.ant-select-item-option-content')].map(
      (item) => item.textContent
    );
    expect(optionTexts).toEqual(['^flow-http', '^shared-http', '^context-http', '^global-http']);

    const clickOption = async (label: string) => {
      const currentDropdown = getDropdown() ?? (await openSelect(div));
      const option = await shouldHappen(() =>
        [...currentDropdown.querySelectorAll<HTMLElement>('.ant-select-item-option-content')].find(
          (item) => item.textContent === label
        )
      );
      await userEvent.click(page.elementLocator(option));
      await shouldHappen(() => !getDropdown());
    };

    await clickOption('^flow-http');
    await clickOption('^context-http');
    await clickOption('^global-http');

    expect(onPathChange.mock.calls).toEqual([
      ['^flow-http.#output'],
      ['^context-http.#output'],
      ['^global-http.#output'],
    ]);
  });

  it('opens the inspector popup for a bound library #context service block', async function () {
    const flow = Root.instance.addFlow('+ServiceEditorLib.mainFlow', undefined, undefined, true);
    const contextFlow = Root.instance.queryValue('+ServiceEditorLib.#context') as Flow;
    flow.createBlock('block').setValue('#is', 'add');
    const ctxSvc = contextFlow.createBlock('^ctx-add');
    ctxSvc.setValue('#is', 'add');
    ctxSvc.setValue('0', 7);

    const [, conn] = makeLocalConnection(Root.instance);
    const desc: PropDesc = {name: 'service', type: 'service', options: ['math']};

    const [, div] = loadTemplate(
      <EditPolicyProvider conn={conn}>
        <ServiceEditor
          conn={conn}
          keys={['+ServiceEditorLib.mainFlow.block']}
          value={undefined}
          bindingPath="^ctx-add.#output"
          funcDesc={blankFuncDesc}
          desc={desc}
        />
      </EditPolicyProvider>,
      'editor'
    );

    const inspectButton = await shouldHappen(() =>
      div.querySelector<HTMLElement>('.ticl-e-service-editor .anticon-ellipsis')?.closest('button')
    );
    await userEvent.click(page.elementLocator(inspectButton));

    await shouldHappen(() => document.body.querySelector('.ticl-e-property-list'));
    await shouldHappen(() =>
      [...document.body.querySelectorAll<HTMLInputElement>('.ticl-e-property-list input.ant-input')].some(
        (input) => input.value === '7'
      )
    );
  });
});
