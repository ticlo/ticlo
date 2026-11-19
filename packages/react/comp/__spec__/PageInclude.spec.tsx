import React, {StrictMode} from 'react';
import {Block, Flow, MemoryFlowStorage, Root, type DataMap} from '@ticlo/core';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.ts';
import {TicloPage} from '../TicloPage.tsx';
import {resolvePageIncludeTarget} from '../PageInclude.tsx';
import '../../index.ts';
import '../../style/index.css';

describe('PageInclude', () => {
  let reactRoot: ReactRoot;
  let runtimeRoot: Root | null = null;

  beforeEach(() => {
    reactRoot = creatReactRoot();
    document.body.append(reactRoot.div);
  });

  afterEach(async () => {
    reactRoot.remove();
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    if (runtimeRoot) {
      await runtimeRoot.stop({discardChanges: true});
      runtimeRoot.destroy();
      runtimeRoot = null;
    }
  });

  async function setupStorageRuntime(
    files: Record<string, DataMap>,
    startOptions: Record<string, {flows?: string[]}> = {main: {flows: ['AA']}},
    libraries: string[] = ['main']
  ) {
    const root = new Root();
    runtimeRoot = root;
    const storage = new MemoryFlowStorage();
    for (const lib of libraries) {
      await storage.saveLibraryMetadata(lib, {});
    }
    for (const [key, data] of Object.entries(files)) {
      storage.saveFlow(null, data, key);
    }
    await root.setStorage(storage);
    await root.start(startOptions);
    return {root, storage};
  }

  it('resolves valid flow paths and rejects modules, context, and non-ticlo paths', () => {
    expect(resolvePageIncludeTarget('+/BB.ticlo', '+main')).toEqual({
      ref: {library: 'main', kind: 'flow', name: 'BB'},
      path: '+main.BB',
    });
    expect(resolvePageIncludeTarget('BB.ticlo', '+main')).toEqual({
      ref: {library: 'main', kind: 'flow', name: 'BB'},
      path: '+main.BB',
    });
    expect(resolvePageIncludeTarget('+shared/sub/BB.ticlo', '+main')).toEqual({
      ref: {library: 'shared', kind: 'flow', name: 'sub.BB'},
      path: '+shared.sub.BB',
    });
    expect(resolvePageIncludeTarget('+/sub/CC.ticlo', '+#root')).toEqual({
      ref: {library: '#root', kind: 'flow', name: 'sub.CC'},
      path: 'sub.CC',
    });

    expect(resolvePageIncludeTarget('+main/#modules/tools.ticlo', '+main')).toBeNull();
    expect(resolvePageIncludeTarget('+/#modules/tools.ticlo', '+main')).toBeNull();
    expect(resolvePageIncludeTarget('+/#context.ticlo', '+main')).toBeNull();
    expect(resolvePageIncludeTarget('+/image.png', '+main')).toBeNull();
    expect(resolvePageIncludeTarget('https://example.com/BB.ticlo', '+main')).toBeNull();
    expect(resolvePageIncludeTarget('++front/BB.ticlo', '+main')).toBeNull();
    expect(resolvePageIncludeTarget('', '+main')).toBeNull();
  });

  it('loads unloaded flow, reuses already-loaded flow, and shares one Flow across multiple PageIncludes', async () => {
    const {root} = await setupStorageRuntime(
      {
        '+main.AA': {
          '#is': '',
          '#main': {
            '#is': 'react:div',
            '#order': ['p1', 'p2', 'p3'],
            'p1': {
              '#is': 'react:page-include',
              'src': '+/BB.ticlo',
              'style': {width: 120, height: 60},
              'label': 'First',
            },
            'p2': {
              '#is': 'react:page-include',
              'src': 'BB.ticlo',
              'style': {width: 240, height: 90},
            },
            'p3': {
              '#is': 'react:page-include',
              'src': '+shared/CC.ticlo',
              'style': {width: 150, height: 70},
            },
          },
        },
        '+main.BB': {
          '#is': '',
          '#inputs': {
            '#is': '',
            '#custom': [{name: 'label', type: 'string'}],
            'label': 'Default BB',
          },
          '#main': {
            '#is': 'react:span',
            '~content': '##.#inputs.label',
          },
          '#outputs': {
            '#is': '',
            '#custom': [{name: 'result', type: 'string'}],
            '~result': '##.#inputs.label',
          },
        },
        '+shared.CC': {
          '#is': '',
          '#main': {'#is': 'react:p', 'content': 'Shared CC'},
        },
      },
      {main: {flows: ['AA']}, shared: {flows: ['CC']}},
      ['main', 'shared']
    );

    const aa = root.queryValue('+main.AA') as Flow;
    aa.startHistory();
    expect(root.getFlowState({library: 'main', kind: 'flow', name: 'BB'})).toBe('unloaded');
    const cc = root.queryValue('+shared.CC') as Flow;
    expect(cc).toBeInstanceOf(Flow);

    await reactRoot.waitRender(<TicloPage block={aa} />);
    await shouldHappen(
      () =>
        reactRoot.div.querySelectorAll('span').length === 2 &&
        Array.from(reactRoot.div.querySelectorAll('span')).every((el) => el.textContent === 'First') &&
        reactRoot.div.querySelector('p')?.textContent === 'Shared CC'
    );

    const bb = root.queryValue('+main.BB') as Flow;
    expect(bb).toBeInstanceOf(Flow);
    // CC was already loaded and must be reused without replacement.
    expect(root.queryValue('+shared.CC')).toBe(cc);

    // Both PageIncludes render BB's shared state while keeping independent container styles.
    const includes = reactRoot.div.querySelectorAll<HTMLElement>('.ticl-page-include');
    expect(includes.length).toBe(3);
    expect(includes[0].style.width).toBe('120px');
    expect(includes[1].style.width).toBe('240px');
    expect(Array.from(reactRoot.div.querySelectorAll('span')).map((el) => el.textContent)).toEqual(['First', 'First']);
    expect(reactRoot.div.querySelector('p').textContent).toBe('Shared CC');

    // Runtime I/O bridging populates #props and outputs on both hosts without dirtying AA or BB.
    const p1 = aa.queryValue('#main.p1') as Block;
    const p2 = aa.queryValue('#main.p2') as Block;
    await shouldHappen(() => p1.getValue('result') === 'First' && p2.getValue('result') === 'First');
    expect(p1.getValue('#props')).toEqual([
      {name: 'label', type: 'string'},
      {name: 'result', type: 'string', readonly: true},
    ]);
    expect(aa.getValue('@has-change')).toBeUndefined();
    expect(bb.getValue('@has-change')).toBeUndefined();

    // Updating p2 overrides shared input; clearing p2 falls back to p1; clearing p1 reverts to BB default.
    p2.setValue('label', 'Second');
    await shouldHappen(
      () =>
        p1.getValue('result') === 'Second' &&
        p2.getValue('result') === 'Second' &&
        Array.from(reactRoot.div.querySelectorAll('span')).every((el) => el.textContent === 'Second')
    );
    p2.setValue('label', undefined);
    await shouldHappen(() => p1.getValue('result') === 'First');
    p1.setValue('label', undefined);
    await shouldHappen(
      () =>
        p1.getValue('result') === 'Default BB' &&
        Array.from(reactRoot.div.querySelectorAll('span')).every((el) => el.textContent === 'Default BB')
    );
  });

  it('applies #closeMode (off, disable, on) with last-closer-wins and restores runtime-disabled flows', async () => {
    const {root, storage} = await setupStorageRuntime({
      '+main.AA': {
        '#is': '',
        '#main': {
          '#is': 'react:div',
          '#order': ['p1', 'p2'],
          'p1': {'#is': 'react:page-include', 'src': '+/BB.ticlo', '#closeMode': 'off'},
          'p2': {'#is': 'react:page-include', 'src': '+/BB.ticlo', '#closeMode': 'on'},
        },
      },
      '+main.BB': {
        '#is': '',
        '#main': {'#is': 'react:span', 'content': 'BB'},
        '#outputs': {'#is': '', '#custom': [{name: 'out', type: 'number'}], 'out': 7},
      },
      '+main.CC': {
        '#is': '',
        '#disabled': true,
        '#main': {'#is': 'react:span', 'content': 'Disabled CC'},
      },
    });

    const aa = root.queryValue('+main.AA') as Flow;
    const main = aa.getValue('#main') as Block;
    const p1 = main.getValue('p1') as Block;
    const p2 = main.getValue('p2') as Block;

    await reactRoot.waitRender(<TicloPage block={aa} />);
    await shouldHappen(() => p1.getValue('out') === 7 && p2.getValue('out') === 7);

    // Removing p1 ('off') while p2 ('on') remains open keeps BB loaded and enabled.
    main.setValue('#order', ['p2']);
    await reactRoot.waitRender();
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(root.getFlowState({library: 'main', kind: 'flow', name: 'BB'})).toBe('enabled');
    expect(p1.getValue('out')).toBeUndefined();
    expect(p2.getValue('out')).toBe(7);

    // Removing p2 (last closer, '#closeMode': 'on') keeps BB loaded.
    main.setValue('#order', []);
    await reactRoot.waitRender();
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(root.getFlowState({library: 'main', kind: 'flow', name: 'BB'})).toBe('enabled');

    // Re-attach p1 with '#closeMode': 'disable', then unmount -> runtime disables BB without persisting #disabled.
    p1.setValue('#closeMode', 'disable');
    main.setValue('#order', ['p1']);
    await reactRoot.waitRender();
    await shouldHappen(() => p1.getValue('out') === 7);

    main.setValue('#order', []);
    await reactRoot.waitRender();
    await shouldHappen(() => root.getFlowState({library: 'main', kind: 'flow', name: 'BB'}) === 'disabled');
    expect((await storage.loadFlow('+main.BB'))['#disabled']).toBeUndefined();

    // Opening BB again automatically restores it to enabled; switching src to saved-disabled CC honors saved #disabled.
    p1.setValue('#closeMode', 'off');
    main.setValue('#order', ['p1']);
    await reactRoot.waitRender();
    await shouldHappen(() => root.getFlowState({library: 'main', kind: 'flow', name: 'BB'}) === 'enabled');

    p1.setValue('src', '+/CC.ticlo');
    await reactRoot.waitRender();
    await shouldHappen(() => root.getFlowState({library: 'main', kind: 'flow', name: 'BB'}) === 'unloaded');
    expect(root.getFlowState({library: 'main', kind: 'flow', name: 'CC'})).toBe('disabled');

    // Closing CC with 'disable' and reopening must still respect CC's saved #disabled: true.
    p1.setValue('#closeMode', 'disable');
    main.setValue('#order', []);
    await reactRoot.waitRender();
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    main.setValue('#order', ['p1']);
    await reactRoot.waitRender();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(root.getFlowState({library: 'main', kind: 'flow', name: 'CC'})).toBe('disabled');
  });

  it('enforces default (8) and custom #inputs.#maxInstance and stops self-include safely', async () => {
    const defaultIds = Array.from({length: 9}, (_, i) => `d${i}`);
    const customIds = Array.from({length: 3}, (_, i) => `c${i}`);
    const {root} = await setupStorageRuntime({
      '+main.AA': {
        '#is': '',
        '#main': {
          '#is': 'react:div',
          '#order': [...defaultIds, ...customIds, 'self'],
          ...Object.fromEntries(
            defaultIds.map((id) => [id, {'#is': 'react:page-include', 'src': '+/DefaultMax.ticlo'}])
          ),
          ...Object.fromEntries(customIds.map((id) => [id, {'#is': 'react:page-include', 'src': '+/CustomMax.ticlo'}])),
          'self': {'#is': 'react:page-include', 'src': '+/SelfLoop.ticlo'},
        },
      },
      '+main.DefaultMax': {
        '#is': '',
        '#main': {'#is': 'react:span', 'content': 'D'},
      },
      '+main.CustomMax': {
        '#is': '',
        '#inputs': {'#is': '', '#maxInstance': 2},
        '#main': {'#is': 'react:p', 'content': 'C'},
      },
      '+main.SelfLoop': {
        '#is': '',
        '#inputs': {'#is': '', '#maxInstance': 3, '#custom': [{name: 'x', type: 'number'}], 'x': 5},
        '#main': {
          '#is': 'react:div',
          '#order': ['next'],
          'next': {'#is': 'react:page-include', 'src': '+/SelfLoop.ticlo'},
        },
        '#outputs': {'#is': '', '#custom': [{name: 'y', type: 'number'}], '~y': '##.#inputs.x'},
      },
    });

    const aa = root.queryValue('+main.AA') as Flow;
    await reactRoot.waitRender(<TicloPage block={aa} />);
    await shouldHappen(
      () => reactRoot.div.querySelectorAll('span').length === 8 && reactRoot.div.querySelectorAll('p').length === 2
    );

    // Self-include capped at #maxInstance = 3 without stack overflow or self-I/O loop.
    const selfLoop = root.queryValue('+main.SelfLoop') as Flow;
    expect(selfLoop).toBeInstanceOf(Flow);
    expect(selfLoop.queryValue('#inputs.x')).toBe(5);
    expect(selfLoop.queryValue('#outputs.y')).toBe(5);
    const selfHost = aa.queryValue('#main.self') as Block;
    await shouldHappen(() => selfHost.getValue('y') === 5);

    // Freeing one slot on CustomMax allows the third PageInclude to mount on re-render.
    const main = aa.getValue('#main') as Block;
    main.setValue('#order', [...defaultIds, 'c1', 'c2']);
    await reactRoot.waitRender();
    await shouldHappen(() => reactRoot.div.querySelectorAll('p').length === 1);
  });

  it('survives StrictMode double-mount and handles ViewDeck tab switching cleanly', async () => {
    const {root} = await setupStorageRuntime({
      '+main.AA': {
        '#is': '',
        '#main': {
          '#is': 'react:view-deck',
          'selectedIndex': 0,
          '#order': ['tab0', 'tab1'],
          'tab0': {'#is': 'react:page-include', 'src': '+/Page0.ticlo', '#closeMode': 'off'},
          'tab1': {'#is': 'react:page-include', 'src': '+/Page1.ticlo', '#closeMode': 'disable'},
        },
      },
      '+main.Page0': {
        '#is': '',
        '#main': {'#is': 'react:span', 'content': 'Tab Zero'},
      },
      '+main.Page1': {
        '#is': '',
        '#main': {'#is': 'react:span', 'content': 'Tab One'},
      },
    });

    const aa = root.queryValue('+main.AA') as Flow;
    const deck = aa.getValue('#main') as Block;
    const tab0 = deck.getValue('tab0') as Block;

    await reactRoot.waitRender(
      <StrictMode>
        <TicloPage block={aa} />
      </StrictMode>
    );

    await shouldHappen(() => reactRoot.div.querySelector('span')?.textContent === 'Tab Zero');
    expect(root.getFlowState({library: 'main', kind: 'flow', name: 'Page0'})).toBe('enabled');
    expect(root.getFlowState({library: 'main', kind: 'flow', name: 'Page1'})).toBe('unloaded');
    expect(tab0.getValue('#props')).toBeUndefined();

    // Switch to tab 1 -> Page0 unloads and Page1 loads.
    deck.setValue('selectedIndex', 1);
    await reactRoot.waitRender();
    await shouldHappen(() => reactRoot.div.querySelector('span')?.textContent === 'Tab One');
    await shouldHappen(() => root.getFlowState({library: 'main', kind: 'flow', name: 'Page0'}) === 'unloaded');
    expect(root.getFlowState({library: 'main', kind: 'flow', name: 'Page1'})).toBe('enabled');

    // Switch back to tab 0 -> Page1 disables and Page0 reloads.
    deck.setValue('selectedIndex', 0);
    await reactRoot.waitRender();
    await shouldHappen(() => reactRoot.div.querySelector('span')?.textContent === 'Tab Zero');
    await shouldHappen(() => root.getFlowState({library: 'main', kind: 'flow', name: 'Page1'}) === 'disabled');
    expect(root.getFlowState({library: 'main', kind: 'flow', name: 'Page0'})).toBe('enabled');
  });
});
