import React from 'react';
import '../style/index.scss';
import {vi} from 'vitest';
import {Block, Root} from '@ticlo/core';
import {ComponentContext, TicloComp, type ElementMap} from '@ticlo/react';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {TicloApp} from '@ticlo/editor/component/TicloApp.tsx';
import {loadTemplate, removeLastTemplate} from '@ticlo/editor/util/test-util.ts';
import {DesignerStage} from '../DesignerStage.tsx';
import {useActiveDesignerStage, type DesignerStageContextValue} from '../DesignerContext.tsx';

async function waitFrames(count = 3) {
  for (let i = 0; i < count; ++i) await new Promise(requestAnimationFrame);
}

describe('DesignerSelectionLayer', () => {
  const path = 'DesignerSelectionLayerTest';
  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue(path);
    vi.restoreAllMocks();
  });

  async function createPage() {
    const flow = Root.instance.addFlow(path, {
      '#main': {
        '#is': 'react:div',
        'style': {height: 700, padding: 20, boxSizing: 'border-box'},
        '#order': ['a', 'b'],
        'a': {'#is': 'react:p', '#optional': ['id'], 'id': 'first', 'style': {width: 100, height: 40, margin: 0}},
        'b': {
          '#is': 'react:p',
          '#optional': ['id'],
          'id': 'second',
          'content': 'Second',
          'style': {width: 120, height: 40, margin: 0},
        },
      },
    });
    const main = flow.getValue('#main') as Block;
    const a = main.getValue('a') as Block;
    const b = main.getValue('b') as Block;
    a.updateValue('content', <span key="label">First</span>);
    let stage: DesignerStageContextValue;
    function Panel(): null {
      stage = useActiveDesignerStage();
      return null;
    }
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    const [, div] = loadTemplate(
      <TicloApp value={{}}>
        <div style={{width: 320, height: 180}}>
          <DesignerStage root={Root.instance} conn={conn} basePath={path} />
        </div>
        <Panel />
      </TicloApp>
    );
    await shouldHappen(() => stage?.main === main && div.querySelector('#first'));
    const page = div.querySelector('.ticl-designer-page') as HTMLElement;
    const host = div.querySelector('.ticl-designer-stage') as HTMLElement;
    const selected = () => div.querySelectorAll<HTMLElement>('.ticl-designer-selection-rect');
    const hovered = () => div.querySelector<HTMLElement>('.ticl-designer-hover-rect');
    return {main, a, b, page, host, selected, hovered, getStage: () => stage};
  }

  it('renders selection and hover outside the page, passes through pointers, and retains selection across root changes', async () => {
    const {a, b, page, host, selected, hovered, getStage} = await createPage();
    const first = page.querySelector<HTMLElement>('#first');
    const second = page.querySelector<HTMLElement>('#second');
    const layer = host.querySelector('.ticl-designer-selection-layer');
    expect(layer.parentElement).toBe(host);
    expect(page.contains(layer)).toBe(false);
    second.dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
    await shouldHappen(() => hovered());
    expect(hovered().style.width).toBe('120px');
    first.querySelector('span').dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    await shouldHappen(() => selected().length === 1 && getStage().selection.blocks[0] === a);
    expect(selected()[0].style.width).toBe('100px');
    const bounds = first.getBoundingClientRect();
    expect(page.contains(document.elementFromPoint(bounds.left + 5, bounds.top + 5))).toBe(true);
    second.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, ctrlKey: true}));
    await shouldHappen(() => selected().length === 2 && !hovered());
    expect(getStage().selection.blocks).toEqual([a, b]);
    host.dispatchEvent(new PointerEvent('pointerleave'));
    getStage().select([a]);
    a.setValue('#is', 'react:div');
    await shouldHappen(() => page.querySelector('#first').tagName === 'DIV' && selected().length === 1);
    const replacement = page.querySelector<HTMLElement>('#first');
    const map = getStage().elementMap;
    expect(map.getBlock(first)).toBeUndefined();
    expect(map.getBlock(replacement)).toBe(a);
    expect(getStage().selection.blocks).toEqual([a]);
    getStage().setDesignMode(false);
    await shouldHappen(() => !host.querySelector('.ticl-designer-selection-layer'));
    expect(map.getBlock(replacement)).toBe(a);
    expect(getStage().selection.blocks).toEqual([a]);
    getStage().setDesignMode(true);
    await shouldHappen(() => selected().length === 1);
    removeLastTemplate();
    expect(map.getElements(a).length).toBe(0);
    expect(map.getElements(b).length).toBe(0);
  });

  it('measures only on target changes, scroll, and resize, and coalesces updates', async () => {
    const {a, page, host, selected, hovered, getStage} = await createPage();
    const first = page.querySelector<HTMLElement>('#first');
    const second = page.querySelector<HTMLElement>('#second');
    first.dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
    await shouldHappen(() => hovered());
    getStage().select([a]);
    await shouldHappen(() => selected().length === 1 && !hovered());
    await waitFrames();
    const measure = vi.spyOn(first, 'getBoundingClientRect');
    const otherMeasure = vi.spyOn(second, 'getBoundingClientRect');
    for (let i = 0; i < 10; ++i) {
      first.querySelector('span').dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
      first.dispatchEvent(new PointerEvent('pointermove', {bubbles: true}));
    }
    await waitFrames();
    expect(measure).not.toHaveBeenCalled();
    for (let i = 0; i < 10; ++i) page.dispatchEvent(new Event('scroll'));
    await waitFrames();
    expect(measure).toHaveBeenCalledTimes(1);
    expect(otherMeasure).not.toHaveBeenCalled();
    page.scrollTop = 30;
    await shouldHappen(
      () => parseFloat(selected()[0].style.top) === first.getBoundingClientRect().top - host.getBoundingClientRect().top
    );
    first.style.width = '140px';
    await shouldHappen(() => selected()[0].style.width === '140px');
    first.style.display = 'none';
    await shouldHappen(() => selected().length === 0);
    expect(getStage().selection.blocks).toEqual([a]);
    first.style.display = '';
    await shouldHappen(() => selected().length === 1);
    getStage().setDesignMode(false);
    await shouldHappen(() => !host.querySelector('.ticl-designer-selection-layer'));
    await waitFrames();
    measure.mockClear();
    page.dispatchEvent(new Event('scroll'));
    first.dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
    await waitFrames();
    expect(measure).not.toHaveBeenCalled();
  });

  it('draws all instances of a selected block while keeping repeated stages independent', async () => {
    const flow = Root.instance.addFlow(path, {'#main': {'#is': 'react:div'}});
    const main = flow.getValue('#main') as Block;
    const child = main.createBlock('child');
    child.setValue('#is', 'react:p');
    child.setValue('content', 'Repeated');
    const maps = new Set<ElementMap>();
    function Probe() {
      maps.add(React.useContext(ComponentContext).elementMap);
      return (
        <>
          <TicloComp block={child} />
          <TicloComp block={child} />
        </>
      );
    }
    main.updateValue('content', <Probe key="instances" />);
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    const [, div] = loadTemplate(
      <div style={{height: 180}}>
        <DesignerStage root={Root.instance} conn={conn} basePath={path} />
        <DesignerStage root={Root.instance} conn={conn} basePath={path} />
      </div>
    );
    await shouldHappen(() => maps.size === 2 && div.querySelectorAll('p').length === 4);
    await waitFrames();
    const [first, second] = div.querySelectorAll('.ticl-designer-stage');
    first.querySelector('p').dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    await shouldHappen(() => first.querySelectorAll('.ticl-designer-selection-rect').length === 2);
    expect(second.querySelectorAll('.ticl-designer-selection-rect').length).toBe(0);
    const [firstMap, secondMap] = maps;
    expect(firstMap.getElements(child).every((element) => first.contains(element))).toBe(true);
    expect(secondMap.getElements(child).every((element) => second.contains(element))).toBe(true);
  });
});
