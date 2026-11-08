import React from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import {simulate} from 'simulate-event';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {LibrarySelectDialog, LibraryTree} from '../LibrarySelectDialog.tsx';

afterEach(removeLastTemplate);

it('expands shared dependencies only on demand and stops at a cycle', async () => {
  const [, element] = loadTemplate(
    <LibraryTree
      graph={{roots: ['main', 'other'], dependencies: {main: ['shared'], other: ['shared'], shared: ['main']}}}
      defaultLibrary="main"
      onUnload={() => {}}
      onSetDefault={() => {}}
    />
  );
  await shouldHappen(() => element.querySelectorAll('button').length === 2);
  expect(element.textContent).not.toContain('shared');

  (element.querySelectorAll('button')[0] as HTMLButtonElement).click();
  await shouldHappen(() => element.textContent.match(/shared/g)?.length === 1);
  (element.querySelectorAll('button')[2] as HTMLButtonElement).click();
  await shouldHappen(() => element.textContent.match(/shared/g)?.length === 2);

  (element.querySelectorAll('button')[1] as HTMLButtonElement).click();
  await shouldHappen(() => element.textContent.match(/main/g)?.length === 2);
  expect(element.querySelectorAll('button').length).toBe(4);
});

it('offers root actions only and sends the selected root to unload', async () => {
  const unload = vi.fn();
  const [, element] = loadTemplate(
    <LibraryTree
      graph={{roots: ['main', 'other'], dependencies: {main: ['shared'], other: [], shared: []}}}
      defaultLibrary="main"
      onUnload={unload}
      onSetDefault={() => {}}
    />
  );
  const rows = await shouldHappen(() => {
    const found = element.querySelectorAll('.ticl-e-library-row');
    return found.length === 2 ? found : null;
  });
  simulate(rows[1], 'contextmenu', {button: 2, clientX: 40, clientY: 40});
  const menu = (await shouldHappen(() =>
    document.querySelector('.ant-dropdown:not(.ant-dropdown-hidden)')
  )) as HTMLElement;
  const action = menu.querySelector('[data-menu-id$="-unload"]');
  expect(action).toBeTruthy();
  simulate(action, 'click');
  expect(unload).toHaveBeenCalledWith('other');
});

it('loads an existing library and creates a new one from the same input', async () => {
  const onCreate = vi.fn(async () => {});
  const onSelect = vi.fn(async () => {});
  loadTemplate(
    <LibrarySelectDialog
      defaultLibrary="main"
      graph={{roots: ['main'], dependencies: {main: []}}}
      listLibraries={async () => ['main', 'other']}
      canCreate={(name) => name === 'new'}
      onCreate={onCreate}
      onSelect={onSelect}
      onUnload={async () => {}}
      onSetDefault={async () => {}}
      onClose={() => {}}
    />
  );
  const modal = (await shouldHappen(() => document.querySelector('.ant-modal'))) as HTMLElement;
  const input = modal.querySelector<HTMLInputElement>('.ant-modal-body input');
  expect(input).toBeTruthy();
  const button = modal.querySelector<HTMLButtonElement>('.ant-modal-body button');
  expect(modal.querySelector('.ant-modal-footer button')).toBeNull();
  const setName = (name: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, name);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  };

  setName('other');
  await waitTick();
  await shouldHappen(() => !button.disabled && input.value === 'other');
  button.click();
  await shouldHappen(() => onSelect.mock.calls.length === 1);
  expect(onSelect).toHaveBeenCalledWith('other', {setDefault: true, unloadOthers: false});
  expect(onCreate).not.toHaveBeenCalled();

  setName('new');
  await waitTick();
  await shouldHappen(() => !button.disabled && input.value === 'new');
  button.click();
  await shouldHappen(() => onCreate.mock.calls.length === 1 && onSelect.mock.calls.length === 2);
  expect(onSelect).toHaveBeenLastCalledWith('new', {setDefault: true, unloadOthers: false});
});
