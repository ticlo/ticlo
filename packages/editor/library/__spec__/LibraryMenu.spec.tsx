import React from 'react';
import {App as AntdApp} from 'antd';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {Root} from '@ticlo/core';
import {MemoryFlowStorage} from '@ticlo/core/block/MemoryFlowStorage.ts';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.ts';
import {EditPolicyProvider} from '../../component/EditPolicyContext.tsx';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {initEditor} from '../../index.ts';
import {AppTheme} from '../../../../app/AppHeader.tsx';
import {LibraryMenuHeader, type LibraryFiles} from '../../../../app/LibraryMenu.tsx';
import {loadLibrarySelection} from '../../../../app/useLibrarySelection.ts';

let root: Root;
let client: ReturnType<typeof makeLocalConnection>[1];
beforeEach(async () => {
  await initEditor();
  root = new Root();
  const storage = new MemoryFlowStorage();
  await storage.saveLibraryMetadata('main', {});
  await storage.saveLibraryMetadata('other', {});
  await root.setStorage(storage);
  await root.start({main: {}});
  [, client] = makeLocalConnection(root, false);
});
afterEach(async () => {
  removeLastTemplate();
  client.destroy();
  await root.stop({discardChanges: true});
  root.destroy();
});

function mount(storage?: LibraryFiles) {
  const select = vi.fn((name, options) => loadLibrarySelection(client, 'main', name, options));
  const setDefault = vi.fn(async (_name: string) => {});
  const [, element] = loadTemplate(
    <AppTheme locale={undefined}>
      <AntdApp>
        <EditPolicyProvider conn={client}>
          <LibraryMenuHeader
            language="en"
            onLanguageChange={() => {}}
            conn={client}
            storage={storage}
            project="main"
            onLibraryChange={select}
            onLibraryUnload={(name) => client.unloadLibrary(name)}
            onSetDefaultLibrary={setDefault}
          />
        </EditPolicyProvider>
      </AntdApp>
    </AppTheme>,
    'editor'
  );
  return {element, select, setDefault};
}

async function openLibraries(element: HTMLElement) {
  const button = await shouldHappen(() =>
    [...element.querySelectorAll('button')].find((button) => button.textContent === 'Library')
  );
  button.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
  const action = await shouldHappen(() =>
    [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')].find(
      (item) => item.textContent === 'Select Library'
    )
  );
  action.click();
  return await shouldHappen(() => document.querySelector<HTMLElement>('.ant-modal'));
}

async function choose(modal: HTMLElement, name: string) {
  const input = modal.querySelector<HTMLInputElement>('.ant-modal-body input');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, name);
  input.dispatchEvent(new Event('input', {bubbles: true}));
  const button = [...modal.querySelectorAll<HTMLButtonElement>('.ant-modal-body button')].at(-1);
  await waitTick();
  await shouldHappen(() => !button.disabled && input.value === name);
  button.click();
}

it('loads a named library through its connection without a file API', async () => {
  const {element, select} = mount();
  await choose(await openLibraries(element), 'other');
  await shouldHappen(() => root.getLibraryGraph().roots.includes('other'));
  expect(select).toHaveBeenCalledWith('other', {setDefault: true, unloadOthers: false});
});

it('uses a file-only catalog for browsing and creation without changing the runtime', async () => {
  vi.spyOn(client, 'getLibraryGraph').mockRejectedValue('invalid command');
  const names = ['main', 'other'];
  const createProject = vi.fn(async (id: string) => {
    names.push(id);
    return {id};
  });
  const storage: LibraryFiles = {
    getCapabilities: () => ({write: true, persistent: true}),
    listProjects: async () => names.map((id) => ({id})),
    createProject,
  };
  const {element, select, setDefault} = mount(storage);
  await choose(await openLibraries(element), 'other');
  await shouldHappen(() => setDefault.mock.calls.length === 1);
  await shouldHappen(() => !document.querySelector('.ant-modal'));
  await choose(await openLibraries(element), 'new');
  await shouldHappen(() => setDefault.mock.calls.length === 2);
  expect(createProject).toHaveBeenCalledWith('new');
  expect(select).not.toHaveBeenCalled();
  expect(root.getLibraryGraph().roots).toEqual(['main']);
});
