import React, {StrictMode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {App, ConfigProvider} from 'antd';
import {theme} from '../../style/theme.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../index.ts';
import {FileManager} from '../FileManager.tsx';
import {previewType} from '../FilePreview.tsx';
import {file, fixtureClient, folder} from './fixtures.ts';
import type {FileManagerProps} from '../FileManager.tsx';

describe('FileManager', () => {
  let root: Root;
  let div: HTMLDivElement;
  beforeEach(async () => {
    await initEditor();
  });
  afterEach(() => {
    root?.unmount();
    root = undefined;
    div?.remove();
    removeLastTemplate();
    vi.restoreAllMocks();
  });

  const view = (props: FileManagerProps) => (
    <StrictMode>
      <ConfigProvider theme={theme}>
        <App style={{height: 600, width: 340}}>
          <FileManager {...props} />
        </App>
      </ConfigProvider>
    </StrictMode>
  );
  function mount(props: FileManagerProps) {
    [, div] = loadTemplate(view(props), 'editor');
  }
  const row = (path: string) => div.querySelector<HTMLElement>(`[data-path="${path}"]`);
  const button = (title: string) => div.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
  async function ready(path = 'proj/demo/a.txt') {
    await shouldHappen(() => row(path) && !button('Reload')?.disabled, 3000);
  }
  async function click(path: string) {
    row(path).click();
    await shouldHappen(() => row(path)?.classList.contains('ticl-e-file-selected'), 1000);
  }
  function key(key: string, extra: KeyboardEventInit = {}) {
    div
      .querySelector('.ticl-e-file-manager')
      .dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, ...extra}));
  }
  function setName(name: string) {
    const input = document.querySelector<HTMLInputElement>('.ant-modal input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, name);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  }
  async function modalButton(confirm: boolean) {
    await shouldHappen(
      () => document.querySelector<HTMLButtonElement>(`.ant-modal .ant-btn${confirm ? '-primary' : '-default'}`),
      2000
    );
    document.querySelector<HTMLButtonElement>(`.ant-modal .ant-btn${confirm ? '-primary' : '-default'}`).click();
  }

  it('recognizes images and common source/config formats while excluding project and binary formats', () => {
    for (const name of ['a.JSON', 'a.js', 'a.yaml', 'a.tsx', 'a.py', 'a.html', 'a.css', 'a.toml', 'README', 'a.jsonc'])
      expect(previewType(name)).toBe('text');
    for (const name of ['a.png', 'a.svg', 'a.JPG']) expect(previewType(name)).toBe('image');
    for (const name of ['a.ticlo', 'a.dg5', 'a.zip', 'README.zip', 'a.pdf', 'a.mp4'])
      expect(previewType(name)).toBeNull();
  });

  it('lazily expands folders, supports multi-selection, and collapses them', async () => {
    const fixture = fixtureClient([
      file('proj/demo/a.txt'),
      folder('proj/demo/folder'),
      file('proj/demo/folder/b.txt'),
    ]);
    mount({client: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    expect(fixture.methods.listFiles.mock.calls.map(([path]) => path)).not.toContain('proj/demo/folder');
    row('proj/demo/folder').querySelector<HTMLElement>('.ticl-e-tree-arr').click();
    await shouldHappen(() => row('proj/demo/folder/b.txt'), 2000);
    await click('proj/demo/a.txt');
    row('proj/demo/folder/b.txt').dispatchEvent(new MouseEvent('click', {bubbles: true, ctrlKey: true}));
    await shouldHappen(() => div.querySelectorAll('.ticl-e-file-selected').length === 2);
    row('proj/demo/folder').querySelector<HTMLElement>('.ticl-e-tree-arr').click();
    await shouldHappen(() => !row('proj/demo/folder/b.txt'));
  });

  it('shows Collapse Children only for one expanded folder and collapses only its descendants', async () => {
    const fixture = fixtureClient([
      file('proj/demo/a.txt'),
      folder('proj/demo/main'),
      folder('proj/demo/main/child'),
      file('proj/demo/main/child/nested.txt'),
      folder('proj/demo/other'),
      file('proj/demo/other/other.txt'),
    ]);
    mount({client: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    const menu = () => document.querySelector<HTMLElement>('.ant-dropdown:not(.ant-dropdown-hidden)');
    const collapseItem = () =>
      Array.from(menu()?.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item') ?? []).find(
        (item) => item.textContent === 'Collapse Children'
      );
    const openMenu = async () => {
      button('Actions').click();
      await shouldHappen(menu, 2000);
    };
    const closeMenu = async () => {
      button('Actions').click();
      await shouldHappen(() => !menu(), 2000);
    };
    for (const path of [undefined, 'proj/demo/a.txt', 'proj/demo/main']) {
      if (path) await click(path);
      await openMenu();
      expect(collapseItem()).toBeUndefined();
      await closeMenu();
    }
    const expand = async (path: string, child: string) => {
      row(path).querySelector<HTMLElement>('.ticl-e-tree-arr').click();
      await shouldHappen(() => row(child), 2000);
    };
    await expand('proj/demo/main', 'proj/demo/main/child');
    await expand('proj/demo/main/child', 'proj/demo/main/child/nested.txt');
    await expand('proj/demo/other', 'proj/demo/other/other.txt');
    await click('proj/demo/main');
    await openMenu();
    expect(collapseItem()).toBeDefined();
    collapseItem().click();
    await shouldHappen(() => !row('proj/demo/main/child/nested.txt'));
    expect(row('proj/demo/main/child')).not.toBeNull();
    expect(row('proj/demo/other/other.txt')).not.toBeNull();
    expect(row('proj/demo/main').classList.contains('ticl-e-file-selected')).toBe(true);
    await shouldHappen(() => !menu(), 2000);
    row('proj/demo/other').dispatchEvent(new MouseEvent('click', {bubbles: true, ctrlKey: true}));
    await shouldHappen(() => div.querySelectorAll('.ticl-e-file-selected').length === 2);
    await openMenu();
    expect(collapseItem()).toBeUndefined();
    await closeMenu();
    await click('proj/demo');
    await openMenu();
    expect(collapseItem()).toBeDefined();
    collapseItem().click();
    await shouldHappen(() => !row('proj/demo/main/child') && !row('proj/demo/other/other.txt'));
    expect(row('proj/demo/a.txt')).not.toBeNull();
    expect(row('proj/demo').classList.contains('ticl-e-file-selected')).toBe(true);
  });

  it('automatically previews small text read-only and leaves unsupported files unloaded', async () => {
    const fixture = fixtureClient([file('proj/demo/a.txt'), file('proj/demo/a.ticlo'), file('proj/demo/a.pdf')]);
    mount({client: fixture.client, project: 'demo'});
    await ready();
    await click('proj/demo/a.txt');
    await shouldHappen(() => div.querySelector('.cm-content')?.textContent === 'preview text', 3000);
    expect(div.querySelector('.cm-content').getAttribute('contenteditable')).toBe('false');
    await click('proj/demo/a.ticlo');
    await shouldHappen(() => div.querySelector('.ticl-e-file-preview')?.textContent.includes('Preview unavailable'));
    await click('proj/demo/a.pdf');
    expect([...new Set(fixture.methods.getFile.mock.calls.map(([path]) => path))]).toEqual(['proj/demo/a.txt']);
  });

  it('requires a click at 100kB for both images and text, and preserves selection when preview is toggled off', async () => {
    const fixture = fixtureClient([file('proj/demo/a.txt', 100000), file('proj/demo/a.svg', 100000)]);
    fixture.methods.getFile.mockResolvedValue({
      data: new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>'
      ).buffer,
      headers: {},
    });
    mount({client: fixture.client, project: 'demo'});
    await ready();
    await click('proj/demo/a.txt');
    await shouldHappen(() => div.querySelector('.ticl-e-file-preview')?.textContent.includes('Load preview'));
    expect(fixture.methods.getFile).not.toHaveBeenCalled();
    await click('proj/demo/a.svg');
    await shouldHappen(() => div.querySelector('.ticl-e-file-preview')?.textContent.includes('Load preview'));
    expect(fixture.methods.getFile).not.toHaveBeenCalled();
    div.querySelector<HTMLButtonElement>('.ticl-e-file-preview button').click();
    await shouldHappen(
      () => div.querySelector<HTMLImageElement>('.ticl-e-file-preview img')?.naturalWidth === 20,
      3000
    );
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    button('Preview').click();
    await shouldHappen(() => !div.querySelector('.ticl-e-file-preview'));
    expect(row('proj/demo/a.svg').classList.contains('ticl-e-file-selected')).toBe(true);
    expect(revoke).toHaveBeenCalled();
    await click('proj/demo/a.txt');
    expect(fixture.methods.getFile).toHaveBeenCalledTimes(1);
    button('Preview').click();
    await shouldHappen(() => div.querySelector('.ticl-e-file-preview')?.textContent.includes('Load preview'));
    div.querySelector<HTMLButtonElement>('.ticl-e-file-preview button').click();
    await shouldHappen(() => div.querySelector('.cm-content'), 3000);
    expect(fixture.methods.getFile).toHaveBeenCalledTimes(2);
  });

  it('copies in place and moves files using keyboard cut/paste', async () => {
    const fixture = fixtureClient([file('proj/demo/a.txt'), folder('proj/demo/folder')]);
    mount({client: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    await click('proj/demo/a.txt');
    key('c', {ctrlKey: true});
    key('v', {ctrlKey: true});
    await ready('proj/demo/a (1).txt');
    expect(fixture.entries.has('proj/demo/a.txt')).toBe(true);
    await click('proj/demo/a.txt');
    key('x', {ctrlKey: true});
    await click('proj/demo/folder');
    key('v', {ctrlKey: true});
    await shouldHappen(() => fixture.entries.has('proj/demo/folder/a.txt') && !button('Reload').disabled, 3000);
    expect(fixture.entries.has('proj/demo/a.txt')).toBe(false);
    key('v', {ctrlKey: true});
    expect(fixture.methods.moveFile).toHaveBeenCalledTimes(1);
  });

  it('uploads native dropped and pasted files into the target folder', async () => {
    const fixture = fixtureClient([file('proj/demo/a.txt'), folder('proj/demo/folder')]);
    mount({client: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    const data = new DataTransfer();
    const payload = new File(['uploaded'], 'new.txt');
    data.items.add(payload);
    row('proj/demo/folder').dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: data}));
    await shouldHappen(() => fixture.entries.has('proj/demo/folder/new.txt'), 3000);
    expect(fixture.methods.uploadFile.mock.calls[0].slice(0, 2)).toEqual(['proj/demo/folder/new.txt', payload]);
    await ready('proj/demo/folder/new.txt');
    await click('proj/demo/folder');
    const clipboard = new DataTransfer();
    clipboard.items.add(new File(['pasted'], 'pasted.txt'));
    div
      .querySelector('.ticl-e-file-manager')
      .dispatchEvent(new ClipboardEvent('paste', {bubbles: true, clipboardData: clipboard}));
    await ready('proj/demo/folder/pasted.txt');
  });

  it('requires confirmation before replacing uploaded files', async () => {
    const fixture = fixtureClient([file('proj/demo/a.txt', 3)]);
    mount({client: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    const drop = () => {
      const data = new DataTransfer();
      data.items.add(new File(['replacement'], 'a.txt'));
      row('proj/demo').dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: data}));
    };
    drop();
    await modalButton(false);
    await ready();
    expect(fixture.methods.uploadFile).not.toHaveBeenCalled();
    expect(fixture.entries.get('proj/demo/a.txt')).toMatchObject({size: 3});
    await shouldHappen(() => !document.querySelector('.ant-modal-confirm'), 2000);
    drop();
    await modalButton(true);
    await shouldHappen(() => fixture.methods.uploadFile.mock.calls.length === 1 && !button('Reload').disabled, 2000);
    expect(fixture.entries.get('proj/demo/a.txt')).toMatchObject({size: 11});
  });

  it('creates, renames and deletes entries through the dialogs, while protecting the project root', async () => {
    const fixture = fixtureClient([file('proj/demo/a.txt')]);
    mount({client: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    button('New Folder').click();
    await shouldHappen(() => document.querySelector('.ant-modal input'), 2000);
    setName('new');
    await shouldHappen(() => !document.querySelector<HTMLButtonElement>('.ant-modal .ant-btn-primary').disabled);
    await modalButton(true);
    await ready('proj/demo/new');
    await shouldHappen(() => !document.querySelector('.ant-modal'), 2000);
    await click('proj/demo/new');
    key('F2');
    await shouldHappen(() => document.querySelector('.ant-modal input'), 2000);
    setName('renamed');
    await shouldHappen(() => document.querySelector<HTMLInputElement>('.ant-modal input').value === 'renamed');
    await modalButton(true);
    await ready('proj/demo/renamed');
    await shouldHappen(() => !document.querySelector('.ant-modal'), 2000);
    await click('proj/demo/renamed');
    key('Delete');
    await modalButton(true);
    await ready();
    expect(fixture.entries.has('proj/demo/renamed')).toBe(false);
    await shouldHappen(() => !document.querySelector('.ant-modal'), 2000);
    await click('proj/demo');
    key('Delete');
    expect(document.querySelector('.ant-modal')).toBeNull();
    expect(fixture.methods.deleteFile.mock.calls.map(([path]) => path)).toEqual(['proj/demo/renamed']);
  });

  it('moves files with an internal drag and reveals the destination folder', async () => {
    const fixture = fixtureClient([file('proj/demo/a.txt'), folder('proj/demo/folder')]);
    mount({client: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    const data = new DataTransfer();
    row('proj/demo/a.txt').dispatchEvent(new DragEvent('dragstart', {bubbles: true, dataTransfer: data}));
    row('proj/demo/folder').dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: data}));
    await ready('proj/demo/folder/a.txt');
    expect(fixture.entries.has('proj/demo/a.txt')).toBe(false);
    expect(fixture.methods.moveFile).toHaveBeenCalledTimes(1);
  });

  it('keeps only unfinished cut entries after a partial move fails', async () => {
    const fixture = fixtureClient([file('proj/demo/a.txt'), file('proj/demo/b.txt'), folder('proj/demo/folder')]);
    const move = fixture.methods.moveFile.getMockImplementation();
    fixture.methods.moveFile.mockImplementationOnce(move).mockRejectedValueOnce(new Error('Move failed'));
    mount({client: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    await click('proj/demo/a.txt');
    row('proj/demo/b.txt').dispatchEvent(new MouseEvent('click', {bubbles: true, ctrlKey: true}));
    await shouldHappen(() => div.querySelectorAll('.ticl-e-file-selected').length === 2);
    key('x', {ctrlKey: true});
    await click('proj/demo/folder');
    key('v', {ctrlKey: true});
    await shouldHappen(
      () => div.querySelector('.ticl-e-file-error')?.textContent.includes('Move failed') && !button('Reload').disabled,
      2000
    );
    expect(fixture.entries.has('proj/demo/folder/a.txt')).toBe(true);
    expect(fixture.entries.has('proj/demo/b.txt')).toBe(true);
    key('v', {ctrlKey: true});
    await ready('proj/demo/folder/b.txt');
    expect(fixture.methods.moveFile.mock.calls.map(([source]) => source)).toEqual([
      'proj/demo/a.txt',
      'proj/demo/b.txt',
      'proj/demo/b.txt',
    ]);
  });

  it('closes outstanding overwrite confirmations when the project changes', async () => {
    const fixture = fixtureClient([file('proj/demo/a.txt'), file('proj/next/a.txt')]);
    div = document.createElement('div');
    document.body.appendChild(div);
    root = createRoot(div);
    root.render(view({client: fixture.client, project: 'demo', defaultPreview: false}));
    await ready();
    const data = new DataTransfer();
    data.items.add(new File(['replacement'], 'a.txt'));
    row('proj/demo').dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: data}));
    await shouldHappen(() => document.querySelector('.ant-modal-confirm'), 2000);
    root.render(view({client: fixture.client, project: 'next', defaultPreview: false}));
    await ready('proj/next/a.txt');
    await shouldHappen(() => !document.querySelector('.ant-modal-confirm'), 2000);
    expect(fixture.methods.uploadFile).not.toHaveBeenCalled();
    expect(fixture.methods.deleteFile).not.toHaveBeenCalled();
  });

  it('cancels old previews and clears the clipboard when the project changes', async () => {
    const fixture = fixtureClient([file('proj/demo/a.txt'), file('proj/next/a.txt')]);
    let resolvePreview: (value: {data: ArrayBuffer; headers: {}}) => void;
    fixture.methods.getFile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePreview = resolve;
        })
    );
    div = document.createElement('div');
    document.body.appendChild(div);
    root = createRoot(div);
    root.render(view({client: fixture.client, project: 'demo'}));
    await ready();
    await click('proj/demo/a.txt');
    await shouldHappen(() => fixture.methods.getFile.mock.calls.length > 0);
    key('c', {ctrlKey: true});
    const signal = fixture.methods.getFile.mock.calls.at(-1)[1].signal;
    root.render(view({client: fixture.client, project: 'next'}));
    await ready('proj/next/a.txt');
    expect(signal.aborted).toBe(true);
    expect(row('proj/demo/a.txt')).toBeNull();
    resolvePreview({data: new TextEncoder().encode('stale').buffer, headers: {}});
    key('v', {ctrlKey: true});
    expect(fixture.methods.copyFile).not.toHaveBeenCalled();
    expect(div.querySelector('.ticl-e-file-preview').textContent).not.toContain('stale');
    expect(fixture.methods.listFiles.mock.calls.every(([path]) => ['proj/demo', 'proj/next'].includes(path))).toBe(
      true
    );
  });
});
