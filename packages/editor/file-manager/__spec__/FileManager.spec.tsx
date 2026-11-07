import React, {StrictMode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {App, ConfigProvider} from 'antd';
import {theme} from '../../style/theme.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../index.ts';
import {FileManager} from '../FileManager.tsx';
import {RemoteStorage} from '@ticlo/remote-storage';
import {Flow, Root as TicloRoot} from '@ticlo/core';
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
  function notifyFiles(fixture: ReturnType<typeof fixtureClient>) {
    const listeners = new Set<(path: string) => void>();
    Object.assign(fixture.client, {
      subscribeFileChanges: (listener: (path: string) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    });
    return (path: string) => listeners.forEach((listener) => listener(path));
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

  async function contextCommand(path: string, label: string) {
    row(path).dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, button: 2}));
    const item = () =>
      [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')].find(
        (item) => item.textContent.trim() === label
      );
    await shouldHappen(item);
    item().click();
  }

  async function submitName(name: string) {
    await shouldHappen(() => document.querySelector('.ant-modal input'));
    setName(name);
    await shouldHappen(() => !document.querySelector<HTMLButtonElement>('.ant-modal .ant-btn-primary').disabled);
    await modalButton(true);
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
    fixture.entries.delete('demo/folder/b.txt');
    fixture.entries.set('demo/folder/c.txt', file('demo/folder/c.txt'));
    row('demo/folder').querySelector<HTMLElement>('.ticl-e-tree-arr').click();
    await shouldHappen(() => row('demo/folder/c.txt') && !row('demo/folder/b.txt'));
    expect(fixture.methods.listFiles.mock.calls.filter(([path]) => path === 'demo/folder')).toHaveLength(2);
  });

  it('refreshes expanded folders after file changes made elsewhere', async () => {
    const fixture = fixtureClient([
      folder('demo/source'),
      file('demo/source/a.txt'),
      folder('demo/target'),
      folder('demo/closed'),
    ]);
    const changed = notifyFiles(fixture);
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready('demo/source');
    row('demo/source').querySelector<HTMLElement>('.ticl-e-tree-arr').click();
    row('demo/target').querySelector<HTMLElement>('.ticl-e-tree-arr').click();
    await shouldHappen(() => row('demo/source/a.txt'));

    const listFolder = fixture.methods.listFiles.getMockImplementation()!;
    let delaySource = true;
    let releaseSource: () => void;
    fixture.methods.listFiles.mockImplementation(async (path) => {
      if (path === 'demo/source' && delaySource) {
        delaySource = false;
        await new Promise<void>((resolve) => {
          releaseSource = resolve;
        });
      }
      return listFolder(path);
    });
    fixture.entries.set('demo/source/a.txt', {...file('demo/source/a.txt'), gitStatus: 'modified'});
    changed('demo/source/a.txt');
    await shouldHappen(() => releaseSource);
    expect(row('demo/source/a.txt')).not.toBeNull();
    releaseSource();
    await shouldHappen(() => row('demo/source/a.txt')?.querySelector('.ticl-e-file-git-modified'));

    fixture.entries.delete('demo/source/a.txt');
    fixture.entries.set('demo/target/a.txt', {...file('demo/target/a.txt'), gitStatus: 'added'});
    changed('demo/source/a.txt');
    changed('demo/target/a.txt');
    await shouldHappen(() => !row('demo/source/a.txt') && row('demo/target/a.txt'));
    expect(row('demo/target/a.txt').querySelector('.ticl-e-file-git-added')).not.toBeNull();
    expect(fixture.methods.listFiles.mock.calls.some(([path]) => path === 'demo/closed')).toBe(false);
    expect(fixture.methods.listFiles.mock.calls.filter(([path]) => path === 'demo').length).toBeGreaterThan(1);
    expect(fixture.methods.listFiles.mock.calls.filter(([path]) => path === 'demo/source').length).toBeGreaterThan(1);
    expect(fixture.methods.listFiles.mock.calls.filter(([path]) => path === 'demo/target').length).toBeGreaterThan(1);

    fixture.entries.delete('demo/source');
    changed('demo/source');
    await shouldHappen(() => !row('demo/source'));
    fixture.entries.set('demo/source', folder('demo/source'));
    fixture.entries.set('demo/source/new.txt', file('demo/source/new.txt'));
    changed('demo/source');
    await shouldHappen(() => row('demo/source'));
    expect(row('demo/source/new.txt')).toBeNull();
    row('demo/source').querySelector<HTMLElement>('.ticl-e-tree-arr').click();
    await shouldHappen(() => row('demo/source/new.txt'));
  });

  it('discards a local file backup from the file menu', async () => {
    const path = 'demo/a.txt';
    const fixture = fixtureClient([{...file(path), localBackup: true}]);
    const changed = notifyFiles(fixture);
    const discardLocalBackup = vi.fn(async (filePath: string) => {
      fixture.entries.set(filePath, file(filePath));
      changed(filePath);
    });
    Object.assign(fixture.client, {discardLocalBackup});
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    expect(row(path).querySelector('.ticl-e-file-local-backup')).not.toBeNull();
    await contextCommand(path, 'Discard Local Backup');
    await modalButton(true);
    await shouldHappen(() => !row(path)?.querySelector('.ticl-e-file-local-backup'));
    expect(discardLocalBackup).toHaveBeenCalledWith(path);
  });

  it('marks a failed editor save purple when the file server disconnects', async () => {
    const baseURL = `https://file-tree-${crypto.randomUUID()}.example/file`;
    let online = true;
    const fetch = vi.fn(async (url: string) => {
      if (!online) throw new TypeError('Network unavailable');
      const {searchParams} = new URL(url);
      const path = searchParams.get('path');
      switch (searchParams.get('op')) {
        case 'user':
          return new Response(JSON.stringify({id: 'alice'}));
        case 'get':
          return path === 'proj/demo/a.ticlo'
            ? new Response('{"value":1}', {headers: {ETag: '"first"'}})
            : new Response('Not found', {status: 404});
        case 'info':
          return new Response(JSON.stringify({path, name: 'demo', type: 'folder'}));
        case 'list':
          return new Response(
            JSON.stringify([
              {path: 'proj/demo/a.ticlo', name: 'a.ticlo', type: 'file'},
              {path: 'proj/demo/other.ticlo', name: 'other.ticlo', type: 'file'},
            ])
          );
        case 'gitInfo':
          return new Response(JSON.stringify({initialized: false}));
        default:
          throw new Error(`Unexpected operation ${searchParams.get('op')}`);
      }
    });
    const storage = new RemoteStorage({baseURL, fetch: fetch as typeof globalThis.fetch});
    const runtime = new TicloRoot();
    try {
      await runtime.setStorage(storage);
      await runtime.start({demo: {flows: ['a']}});
      mount({storage, project: 'demo', defaultPreview: false});
      await ready('demo/a.ticlo');
      online = false;
      const flow = runtime.queryValue('+demo.a') as Flow;
      flow.setValue('value', 2);
      await expect(flow.applyChange()).rejects.toThrow('Network unavailable');
      await shouldHappen(() => row('demo/a.ticlo')?.querySelector('.ticl-e-file-local-backup'), 3000);
      expect(row('demo/other.ticlo')).not.toBeNull();
    } finally {
      root?.unmount();
      root = undefined;
      runtime.destroy();
      await storage.close();
    }
  });

  it('keeps an expanded folder visible until its deletion reload finishes', async () => {
    const fixture = fixtureClient([folder('demo/folder'), file('demo/folder/a.txt')]);
    const changed = notifyFiles(fixture);
    const listFolder = fixture.methods.listFiles.getMockImplementation()!;
    let delayRoot = false;
    let releaseRoot: () => void;
    fixture.methods.listFiles.mockImplementation(async (path) => {
      if (path === 'demo' && delayRoot) {
        delayRoot = false;
        await new Promise<void>((resolve) => {
          releaseRoot = resolve;
        });
      }
      return listFolder(path);
    });
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready('demo/folder');
    row('demo/folder').querySelector<HTMLElement>('.ticl-e-tree-arr').click();
    await shouldHappen(() => row('demo/folder/a.txt'));

    fixture.entries.delete('demo/folder/a.txt');
    fixture.entries.delete('demo/folder');
    delayRoot = true;
    changed('demo/folder');
    await shouldHappen(() => releaseRoot);
    expect(row('demo/folder/a.txt')).not.toBeNull();
    releaseRoot();
    await shouldHappen(() => !row('demo/folder'));
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

  it('opens ticlo files through the menu and double click', async () => {
    const fixture = fixtureClient([file('demo/entry.ticlo'), file('demo/other.ticlo')]);
    const onOpen = vi.fn();
    mount({storage: fixture.client, project: 'demo', onOpen});
    await ready('demo/entry.ticlo');
    await click('demo/other.ticlo');
    expect(button('Actions')).toBeNull();
    row('demo/other.ticlo').dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, button: 2}));
    await shouldHappen(() =>
      [...document.querySelectorAll('.ant-dropdown-menu-item')].some((item) => item.textContent.trim() === 'Open')
    );
    [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')]
      .find((item) => item.textContent.trim() === 'Open')
      .click();
    await shouldHappen(() => onOpen.mock.calls.length === 1);
    expect(onOpen).toHaveBeenCalledWith(file('demo/other.ticlo'));
    await ready('demo/entry.ticlo');
    row('demo/entry.ticlo').dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
    await shouldHappen(() => onOpen.mock.calls.length === 2);
    expect(onOpen).toHaveBeenLastCalledWith(file('demo/entry.ticlo'));
  });

  it('persists dataflows before opening them and uses root toolbar and folder menu destinations', async () => {
    const fixture = fixtureClient([file('demo/a.txt'), folder('demo/folder')]);
    const upload = fixture.methods.uploadFile.getMockImplementation();
    let finishUpload: () => void;
    fixture.methods.uploadFile.mockImplementationOnce(async (...args) => {
      await new Promise<void>((resolve) => {
        finishUpload = resolve;
      });
      return upload(...args);
    });
    const onOpen = vi.fn(async (entry) => {
      expect(fixture.entries.has(entry.path)).toBe(true);
    });
    mount({storage: fixture.client, project: 'demo', defaultPreview: false, onOpen});
    await ready();
    await click('demo/folder');
    button('New Dataflow').click();
    await submitName('root-flow');
    await shouldHappen(() => finishUpload);
    expect(onOpen).not.toHaveBeenCalled();
    finishUpload();
    await ready('demo/root-flow.ticlo');
    await shouldHappen(() => onOpen.mock.calls.length === 1 && !document.querySelector('.ant-modal'));
    expect(onOpen.mock.calls[0][0].path).toBe('demo/root-flow.ticlo');

    await click('demo/a.txt');
    row('demo/folder').dispatchEvent(new MouseEvent('click', {bubbles: true, ctrlKey: true}));
    await shouldHappen(() => div.querySelectorAll('.ticl-e-file-selected').length === 2);
    await contextCommand('demo/folder', 'New Dataflow');
    await submitName('nested');
    await ready('demo/folder/nested.ticlo');
    await shouldHappen(() => onOpen.mock.calls.length === 2 && !document.querySelector('.ant-modal'));
    expect(onOpen.mock.calls[1][0].path).toBe('demo/folder/nested.ticlo');

    fixture.methods.uploadFile.mockRejectedValueOnce(new Error('Write failed'));
    button('New Dataflow').click();
    await submitName('failed');
    await shouldHappen(
      () => div.querySelector('.ticl-e-file-error')?.textContent.includes('Write failed') && !button('Reload').disabled
    );
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(fixture.entries.has('demo/failed.ticlo')).toBe(false);
  });

  it('runs Git commands for the displayed project and allows an empty commit message', async () => {
    const fixture = fixtureClient([file('demo/a.txt')]);
    let initialized = false;
    const initGit = vi.fn(async () => {
      initialized = true;
      return {initialized: true, branch: 'demo'};
    });
    const commitGit = vi.fn(async () => ({
      hash: 'abc',
      author: 'alice',
      email: 'alice@ticlo.app',
      date: new Date().toISOString(),
      message: 'Update project files',
    }));
    Object.assign(fixture.client, {
      supportsGit: () => true,
      getGitInfo: async () => ({initialized, branch: initialized ? 'demo' : undefined}),
      initGit,
      commitGit,
      getGitHistory: async (): Promise<[]> => [],
    });
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    button('Actions').click();
    await shouldHappen(() =>
      [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')].find(
        (item) => item.textContent.trim() === 'Initialize Git'
      )
    );
    expect(
      [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')].map((item) => item.textContent.trim())
    ).toEqual(['Initialize Git']);
    [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')]
      .find((item) => item.textContent.trim() === 'Initialize Git')
      .click();
    await shouldHappen(() => initGit.mock.calls.length === 1 && !button('Reload')?.disabled);
    expect(initGit).toHaveBeenCalledWith('demo', expect.anything());

    button('Actions').click();
    await shouldHappen(() =>
      [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')].find(
        (item) => item.textContent.trim() === 'Git Commit'
      )
    );
    expect(
      [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')].map((item) => item.textContent.trim())
    ).toEqual(['Git Commit', 'Git History']);
    [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')]
      .find((item) => item.textContent.trim() === 'Git Commit')
      .click();
    await shouldHappen(() => document.querySelector('.ant-modal textarea'));
    await modalButton(true);
    await shouldHappen(() => commitGit.mock.calls.length === 1);
    expect(commitGit).toHaveBeenCalledWith('demo', '', expect.anything());
  });

  it('confirms restoring a modified file and restores a deleted file immediately', async () => {
    const modified = {...file('demo/changed.txt'), gitStatus: 'modified' as const};
    const deleted = {...file('demo/deleted.txt'), gitStatus: 'deleted' as const};
    const fixture = fixtureClient([modified, deleted]);
    const restoreGitFile = vi.fn(async (path: string) => {
      fixture.entries.set(path, {...fixture.entries.get(path), gitStatus: undefined});
    });
    Object.assign(fixture.client, {
      supportsGit: () => true,
      getGitInfo: async () => ({initialized: true, branch: 'demo'}),
      restoreGitFile,
    });
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready('demo/changed.txt');

    await contextCommand('demo/changed.txt', 'Discard Changes');
    await shouldHappen(() => document.querySelector('.ant-modal-confirm'));
    expect(restoreGitFile).not.toHaveBeenCalled();
    await modalButton(false);
    await shouldHappen(() => !document.querySelector('.ant-modal-confirm'));
    await contextCommand('demo/changed.txt', 'Discard Changes');
    await modalButton(true);
    await shouldHappen(() => restoreGitFile.mock.calls.length === 1 && !button('Reload')?.disabled);
    expect(restoreGitFile).toHaveBeenCalledWith('demo/changed.txt', expect.anything());
    await shouldHappen(() => !document.querySelector('.ant-modal-confirm'));

    await contextCommand('demo/deleted.txt', 'Restore');
    await shouldHappen(() => restoreGitFile.mock.calls.length === 2 && !button('Reload')?.disabled);
    expect(document.querySelector('.ant-modal-confirm')).toBeNull();
    expect(restoreGitFile).toHaveBeenLastCalledWith('demo/deleted.txt', expect.anything());
  });

  it('keeps Initialize Git visible when Git status cannot be loaded', async () => {
    const fixture = fixtureClient([file('demo/a.txt')]);
    Object.assign(fixture.client, {
      supportsGit: () => true,
      getGitInfo: async () => {
        throw new Error('Git unavailable');
      },
    });
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    button('Actions').click();
    await shouldHappen(() =>
      [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')].some(
        (item) => item.textContent.trim() === 'Initialize Git'
      )
    );
  });

  it('shows pending edits and separates commit comments from logged changes', async () => {
    const fixture = fixtureClient([file('demo/a.txt')]);
    fixture.methods.getFile.mockResolvedValue({
      data: new TextEncoder().encode('2026-11-04T02:00:00Z,alice <alice@example.com>,edit,"docs/a,b.txt"\n').buffer,
      headers: {},
    });
    const commits = [
      {
        hash: 'first',
        author: 'alice',
        email: 'alice@example.com',
        date: '2026-11-04T01:00:00Z',
        message: 'First commit\n\nfirst detail\n\n--- --- ---\n2026-11-04T01:00:00Z,alice,create,"docs/""quoted"".txt"',
      },
      {
        hash: 'second',
        author: 'bob',
        email: 'bob@example.com',
        date: '2026-11-03T01:00:00Z',
        message: 'Second commit\n\nsecond detail',
      },
    ];
    Object.assign(fixture.client, {
      supportsGit: () => true,
      getGitInfo: async () => ({initialized: true, branch: 'demo'}),
      getGitHistory: async () => commits,
    });
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    button('Actions').click();
    await shouldHappen(() =>
      [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')].find(
        (item) => item.textContent.trim() === 'Git History'
      )
    );
    [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')]
      .find((item) => item.textContent.trim() === 'Git History')
      .click();
    await shouldHappen(
      () =>
        document.querySelectorAll('.ticl-e-git-history > .ant-table-wrapper .ant-table-tbody tr[data-row-key]')
          .length === 3
    );
    expect(fixture.methods.getFile).toHaveBeenCalledWith('demo/.gitlog', expect.anything());
    const rows = [
      ...document.querySelectorAll<HTMLElement>(
        '.ticl-e-git-history > .ant-table-wrapper .ant-table-tbody tr[data-row-key]'
      ),
    ];
    expect(rows[0].textContent).toContain('Uncommitted changes');
    expect(document.querySelector('.ticl-e-git-history-changes').textContent).toContain('docs/a,b.txt');
    rows[1].click();
    await shouldHappen(() =>
      document.querySelector('.ticl-e-git-history-comment')?.textContent.includes('first detail')
    );
    expect(rows[1].textContent).toContain('First commit');
    expect(rows[1].textContent).not.toContain('first detail');
    expect(document.querySelector('.ticl-e-git-history-comment').textContent).not.toContain('--- --- ---');
    expect(document.querySelector('.ticl-e-git-history-changes').textContent).toContain('docs/"quoted".txt');
    rows[2].click();
    await shouldHappen(() =>
      document.querySelector('.ticl-e-git-history-comment')?.textContent.includes('second detail')
    );
    expect(document.querySelector('.ticl-e-git-history-changes')).toBeNull();
  });

  it('omits the pending history row when .gitlog is empty', async () => {
    const fixture = fixtureClient([file('demo/a.txt')]);
    fixture.methods.getFile.mockResolvedValue({data: new ArrayBuffer(0), headers: {}});
    Object.assign(fixture.client, {
      supportsGit: () => true,
      getGitInfo: async () => ({initialized: true, branch: 'demo'}),
      getGitHistory: async () => [
        {hash: 'first', author: 'alice', email: '', date: '2026-11-04T01:00:00Z', message: 'First'},
      ],
    });
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    button('Actions').click();
    await shouldHappen(() =>
      [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')].find(
        (item) => item.textContent.trim() === 'Git History'
      )
    );
    [...document.querySelectorAll<HTMLElement>('.ant-dropdown-menu-item')]
      .find((item) => item.textContent.trim() === 'Git History')
      .click();
    await shouldHappen(
      () =>
        document.querySelectorAll('.ticl-e-git-history > .ant-table-wrapper .ant-table-tbody tr[data-row-key]')
          .length === 1
    );
    expect(document.querySelector('.ticl-e-git-history-details').textContent).toContain('First');
  });

  it('uses the file tree as a single-file picker without file actions', async () => {
    const fixture = fixtureClient([file('demo/entry.ticlo'), file('demo/other.ticlo')]);
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    mount({storage: fixture.client, project: 'demo', picker: true, onOpen, onSelect});
    await shouldHappen(() => row('demo/entry.ticlo'));
    expect(div.querySelector('.ticl-e-file-toolbar')).toBeNull();
    await click('demo/entry.ticlo');
    row('demo/other.ticlo').dispatchEvent(new MouseEvent('click', {bubbles: true, ctrlKey: true}));
    await shouldHappen(() => onSelect.mock.lastCall?.[0]?.[0]?.path === 'demo/other.ticlo');
    expect(onSelect.mock.lastCall[0]).toHaveLength(1);
    row('demo/other.ticlo').dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
    await shouldHappen(() => onOpen.mock.calls.length === 1);
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

    const input = div.querySelector<HTMLInputElement>('input[type="file"]');
    vi.spyOn(input, 'click').mockImplementation(() => {});
    button('Upload').click();
    const toolbarFiles = new DataTransfer();
    toolbarFiles.items.add(new File(['root'], 'toolbar.txt'));
    Object.defineProperty(input, 'files', {value: toolbarFiles.files, configurable: true});
    input.dispatchEvent(new Event('change', {bubbles: true}));
    await ready('demo/toolbar.txt');
    expect(fixture.entries.has('demo/folder/toolbar.txt')).toBe(false);

    await contextCommand('demo/folder', 'Upload');
    await click('demo');
    const folderFiles = new DataTransfer();
    folderFiles.items.add(new File(['folder'], 'context.txt'));
    Object.defineProperty(input, 'files', {value: folderFiles.files, configurable: true});
    input.dispatchEvent(new Event('change', {bubbles: true}));
    await ready('demo/folder/context.txt');
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
    const fixture = fixtureClient([file('demo/a.txt'), folder('demo/folder')]);
    mount({storage: fixture.client, project: 'demo', defaultPreview: false});
    await ready();
    await click('demo/folder');
    button('New Folder').click();
    await shouldHappen(() => document.querySelector('.ant-modal input'), 2000);
    setName('new');
    await shouldHappen(() => !document.querySelector<HTMLButtonElement>('.ant-modal .ant-btn-primary').disabled);
    await modalButton(true);
    await ready('demo/new');
    expect(fixture.methods.createDirectory).toHaveBeenCalledWith('demo/new', expect.anything());
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
