import React, {StrictMode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {App, ConfigProvider} from 'antd';
import {theme} from '../../style/theme.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../index.ts';
import {FileManager} from '../FileManager.tsx';
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
  async function ready(path = 'demo/a.txt') {
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

  it('lazily expands folders, supports multi-selection, and collapses them', async () => {
    const fixture = fixtureClient([file('demo/a.txt'), folder('demo/folder'), file('demo/folder/b.txt')]);
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    expect(fixture.methods.listFiles.mock.calls.map(([path]) => path)).not.toContain('demo/folder');
    row('demo/folder').querySelector<HTMLElement>('.ticl-e-tree-arr').click();
    await shouldHappen(() => row('demo/folder/b.txt'), 2000);
    await click('demo/a.txt');
    row('demo/folder/b.txt').dispatchEvent(new MouseEvent('click', {bubbles: true, ctrlKey: true}));
    await shouldHappen(() => div.querySelectorAll('.ticl-e-file-selected').length === 2);
    row('demo/folder').querySelector<HTMLElement>('.ticl-e-tree-arr').click();
    await shouldHappen(() => !row('demo/folder/b.txt'));
  });

  it('automatically previews small text read-only and leaves unsupported files unloaded', async () => {
    const fixture = fixtureClient([file('demo/a.txt'), file('demo/a.ticlo'), file('demo/a.pdf')]);
    mount({storage: fixture.client, project: 'demo'});
    await ready();
    await click('demo/a.txt');
    await shouldHappen(() => div.querySelector('.cm-content')?.textContent === 'preview text', 3000);
    expect(div.querySelector('.cm-content').getAttribute('contenteditable')).toBe('false');
    await click('demo/a.ticlo');
    await shouldHappen(() => div.querySelector('.ticl-e-file-preview')?.textContent.includes('Preview unavailable'));
    await click('demo/a.pdf');
    expect([...new Set(fixture.methods.getFile.mock.calls.map(([path]) => path))]).toEqual(['demo/a.txt']);
  });

  it('requires a click at 100kB for both images and text, and preserves selection when preview is toggled off', async () => {
    const fixture = fixtureClient([file('demo/a.txt', 100000), file('demo/a.svg', 100000)]);
    fixture.methods.getFile.mockResolvedValue({
      data: new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>'
      ).buffer,
      headers: {},
    });
    mount({storage: fixture.client, project: 'demo'});
    await ready();
    await click('demo/a.txt');
    await shouldHappen(() => div.querySelector('.ticl-e-file-preview')?.textContent.includes('Load preview'));
    expect(fixture.methods.getFile).not.toHaveBeenCalled();
    await click('demo/a.svg');
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
    expect(row('demo/a.svg').classList.contains('ticl-e-file-selected')).toBe(true);
    expect(revoke).toHaveBeenCalled();
    await click('demo/a.txt');
    expect(fixture.methods.getFile).toHaveBeenCalledTimes(1);
    button('Preview').click();
    await shouldHappen(() => div.querySelector('.ticl-e-file-preview')?.textContent.includes('Load preview'));
    div.querySelector<HTMLButtonElement>('.ticl-e-file-preview button').click();
    await shouldHappen(() => div.querySelector('.cm-content'), 3000);
    expect(fixture.methods.getFile).toHaveBeenCalledTimes(2);
  });

  it('copies in place and moves files using keyboard cut/paste', async () => {
    const fixture = fixtureClient([file('demo/a.txt'), folder('demo/folder')]);
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    await click('demo/a.txt');
    key('c', {ctrlKey: true});
    key('v', {ctrlKey: true});
    await ready('demo/a (1).txt');
    expect(fixture.entries.has('demo/a.txt')).toBe(true);
    await click('demo/a.txt');
    key('x', {ctrlKey: true});
    await click('demo/folder');
    key('v', {ctrlKey: true});
    await shouldHappen(() => fixture.entries.has('demo/folder/a.txt') && !button('Reload').disabled, 3000);
    expect(fixture.entries.has('demo/a.txt')).toBe(false);
    key('v', {ctrlKey: true});
    expect(fixture.methods.moveFile).toHaveBeenCalledTimes(1);
  });

  it('uploads native dropped and pasted files into the target folder', async () => {
    const fixture = fixtureClient([file('demo/a.txt'), folder('demo/folder')]);
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    const data = new DataTransfer();
    const payload = new File(['uploaded'], 'new.txt');
    data.items.add(payload);
    row('demo/folder').dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: data}));
    await shouldHappen(() => fixture.entries.has('demo/folder/new.txt'), 3000);
    expect(fixture.methods.uploadFile.mock.calls[0].slice(0, 2)).toEqual(['demo/folder/new.txt', payload]);
    await ready('demo/folder/new.txt');
    await click('demo/folder');
    const clipboard = new DataTransfer();
    clipboard.items.add(new File(['pasted'], 'pasted.txt'));
    div
      .querySelector('.ticl-e-file-manager')
      .dispatchEvent(new ClipboardEvent('paste', {bubbles: true, clipboardData: clipboard}));
    await ready('demo/folder/pasted.txt');
  });

  it('requires confirmation before replacing uploaded files', async () => {
    const fixture = fixtureClient([file('demo/a.txt', 3)]);
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    const drop = () => {
      const data = new DataTransfer();
      data.items.add(new File(['replacement'], 'a.txt'));
      row('demo').dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: data}));
    };
    drop();
    await modalButton(false);
    await ready();
    expect(fixture.methods.uploadFile).not.toHaveBeenCalled();
    expect(fixture.entries.get('demo/a.txt')).toMatchObject({size: 3});
    await shouldHappen(() => !document.querySelector('.ant-modal-confirm'), 2000);
    drop();
    await modalButton(true);
    await shouldHappen(() => fixture.methods.uploadFile.mock.calls.length === 1 && !button('Reload').disabled, 2000);
    expect(fixture.entries.get('demo/a.txt')).toMatchObject({size: 11});
  });

  it('creates, renames and deletes entries through the dialogs, while protecting the project root', async () => {
    const fixture = fixtureClient([file('demo/a.txt')]);
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    button('New Folder').click();
    await shouldHappen(() => document.querySelector('.ant-modal input'), 2000);
    setName('new');
    await shouldHappen(() => !document.querySelector<HTMLButtonElement>('.ant-modal .ant-btn-primary').disabled);
    await modalButton(true);
    await ready('demo/new');
    await shouldHappen(() => !document.querySelector('.ant-modal'), 2000);
    await click('demo/new');
    key('F2');
    await shouldHappen(() => document.querySelector('.ant-modal input'), 2000);
    setName('renamed');
    await shouldHappen(() => document.querySelector<HTMLInputElement>('.ant-modal input').value === 'renamed');
    await modalButton(true);
    await ready('demo/renamed');
    await shouldHappen(() => !document.querySelector('.ant-modal'), 2000);
    await click('demo/renamed');
    key('Delete');
    await modalButton(true);
    await ready();
    expect(fixture.entries.has('demo/renamed')).toBe(false);
    await shouldHappen(() => !document.querySelector('.ant-modal'), 2000);
    await click('demo');
    key('Delete');
    expect(document.querySelector('.ant-modal')).toBeNull();
    expect(fixture.methods.deleteFile.mock.calls.map(([path]) => path)).toEqual(['demo/renamed']);
  });

  it('moves files with an internal drag and reveals the destination folder', async () => {
    const fixture = fixtureClient([file('demo/a.txt'), folder('demo/folder')]);
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    const data = new DataTransfer();
    row('demo/a.txt').dispatchEvent(new DragEvent('dragstart', {bubbles: true, dataTransfer: data}));
    row('demo/folder').dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: data}));
    await ready('demo/folder/a.txt');
    expect(fixture.entries.has('demo/a.txt')).toBe(false);
    expect(fixture.methods.moveFile).toHaveBeenCalledTimes(1);
  });

  it('keeps only unfinished cut entries after a partial move fails', async () => {
    const fixture = fixtureClient([file('demo/a.txt'), file('demo/b.txt'), folder('demo/folder')]);
    const move = fixture.methods.moveFile.getMockImplementation();
    fixture.methods.moveFile.mockImplementationOnce(move).mockRejectedValueOnce(new Error('Move failed'));
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    await click('demo/a.txt');
    row('demo/b.txt').dispatchEvent(new MouseEvent('click', {bubbles: true, ctrlKey: true}));
    await shouldHappen(() => div.querySelectorAll('.ticl-e-file-selected').length === 2);
    key('x', {ctrlKey: true});
    await click('demo/folder');
    key('v', {ctrlKey: true});
    await shouldHappen(
      () => div.querySelector('.ticl-e-file-error')?.textContent.includes('Move failed') && !button('Reload').disabled,
      2000
    );
    expect(fixture.entries.has('demo/folder/a.txt')).toBe(true);
    expect(fixture.entries.has('demo/b.txt')).toBe(true);
    key('v', {ctrlKey: true});
    await ready('demo/folder/b.txt');
    expect(fixture.methods.moveFile.mock.calls.map(([source]) => source)).toEqual([
      'demo/a.txt',
      'demo/b.txt',
      'demo/b.txt',
    ]);
  });

  it('closes outstanding overwrite confirmations when the project changes', async () => {
    const fixture = fixtureClient([file('demo/a.txt'), file('next/a.txt')]);
    div = document.createElement('div');
    document.body.appendChild(div);
    root = createRoot(div);
    root.render(view({storage: fixture.client, project: 'demo', defaultPreview: false}));
    await ready();
    const data = new DataTransfer();
    data.items.add(new File(['replacement'], 'a.txt'));
    row('demo').dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: data}));
    await shouldHappen(() => document.querySelector('.ant-modal-confirm'), 2000);
    root.render(view({storage: fixture.client, project: 'next', defaultPreview: false}));
    await ready('next/a.txt');
    await shouldHappen(() => !document.querySelector('.ant-modal-confirm'), 2000);
    expect(fixture.methods.uploadFile).not.toHaveBeenCalled();
    expect(fixture.methods.deleteFile).not.toHaveBeenCalled();
  });

  it('cancels old previews and clears the clipboard when the project changes', async () => {
    const fixture = fixtureClient([file('demo/a.txt'), file('next/a.txt')]);
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
    root.render(view({storage: fixture.client, project: 'demo'}));
    await ready();
    await click('demo/a.txt');
    await shouldHappen(() => fixture.methods.getFile.mock.calls.length > 0);
    key('c', {ctrlKey: true});
    const signal = fixture.methods.getFile.mock.calls.at(-1)[1].signal;
    root.render(view({storage: fixture.client, project: 'next'}));
    await ready('next/a.txt');
    expect(signal.aborted).toBe(true);
    expect(row('demo/a.txt')).toBeNull();
    resolvePreview({data: new TextEncoder().encode('stale').buffer, headers: {}});
    key('v', {ctrlKey: true});
    expect(fixture.methods.copyFile).not.toHaveBeenCalled();
    expect(div.querySelector('.ticl-e-file-preview').textContent).not.toContain('stale');
    expect(fixture.methods.listFiles.mock.calls.every(([path]) => ['demo', 'next'].includes(path))).toBe(true);
  });
});
