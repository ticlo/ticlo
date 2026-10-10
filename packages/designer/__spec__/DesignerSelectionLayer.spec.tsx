import React from 'react';
import '../style/index.css';
import {vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {Block, Root} from '@ticlo/core';
import {ComponentContext, TicloComp, type ElementMap} from '@ticlo/react';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {DesignerApp} from '../DesignerApp.tsx';
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
      <DesignerApp value={{}}>
        <div style={{width: 320, height: 180}}>
          <DesignerStage root={Root.instance} conn={conn} basePath={path} />
        </div>
        <Panel />
      </DesignerApp>
    );
    await shouldHappen(() => stage?.main === main && div.querySelector('#first'));
    const page = div.querySelector('.ticl-d-page') as HTMLElement;
    const host = div.querySelector('.ticl-d-stage') as HTMLElement;
    const selected = () => div.querySelectorAll<SVGPolygonElement>('.ticl-d-selection-rect');
    const hovered = () => div.querySelector<SVGPolygonElement>('.ticl-d-hover-rect');
    return {main, a, b, page, host, selected, hovered, getStage: () => stage};
  }

  it('renders selection and hover outside the page, passes through pointers, and retains selection across root changes', async () => {
    const {a, b, page, host, selected, hovered, getStage} = await createPage();
    const first = page.querySelector<HTMLElement>('#first');
    const second = page.querySelector<HTMLElement>('#second');
    const layer = host.querySelector('.ticl-d-selection-layer');
    expect(layer.parentElement).toBe(host);
    expect(page.contains(layer)).toBe(false);
    await userEvent.hover(second);
    await expect.poll(() => hovered() && hovered().points.getItem(1).x - hovered().points.getItem(0).x).toBe(120);
    await userEvent.click(first.querySelector('span'));
    await shouldHappen(() => selected().length === 1 && getStage().selection.blocks[0] === a);
    expect(selected()[0].points.getItem(1).x - selected()[0].points.getItem(0).x).toBe(100);
    const bounds = first.getBoundingClientRect();
    expect(page.contains(document.elementFromPoint(bounds.left + 5, bounds.top + 5))).toBe(true);
    await userEvent.click(second, {modifiers: ['Control']});
    await shouldHappen(() => selected().length === 2 && !hovered());
    expect(getStage().selection.blocks).toEqual([a, b]);
    await userEvent.unhover(host);
    getStage().select([a]);
    a.setValue('#is', 'react:div');
    await shouldHappen(() => page.querySelector('#first').tagName === 'DIV' && selected().length === 1);
    const replacement = page.querySelector<HTMLElement>('#first');
    const map = getStage().elementMap;
    expect(map.getBlock(first)).toBeUndefined();
    expect(map.getBlock(replacement)).toBe(a);
    expect(getStage().selection.blocks).toEqual([a]);
    getStage().setDesignMode(false);
    await shouldHappen(() => !host.querySelector('.ticl-d-selection-layer'));
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
    await userEvent.hover(first);
    await shouldHappen(() => hovered());
    getStage().select([a]);
    await shouldHappen(() => selected().length === 1 && !hovered());
    await waitFrames();
    const measure = vi.spyOn(window, 'getComputedStyle');
    const reads = (element: Element) => measure.mock.calls.filter(([target]) => target === element).length;
    for (let i = 0; i < 10; ++i) {
      first.querySelector('span').dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
      first.dispatchEvent(new PointerEvent('pointermove', {bubbles: true}));
    }
    await waitFrames();
    expect(reads(first)).toBe(0);
    for (let i = 0; i < 10; ++i) page.dispatchEvent(new Event('scroll'));
    await waitFrames();
    expect(reads(first)).toBe(1);
    expect(reads(second)).toBe(0);
    page.scrollTop = 30;
    await shouldHappen(
      () => selected()[0].points.getItem(0).y === first.getBoundingClientRect().top - host.getBoundingClientRect().top
    );
    first.style.width = '140px';
    await shouldHappen(() => selected()[0].points.getItem(1).x - selected()[0].points.getItem(0).x === 140);
    first.style.display = 'none';
    await shouldHappen(() => selected().length === 0);
    expect(getStage().selection.blocks).toEqual([a]);
    first.style.display = '';
    await shouldHappen(() => selected().length === 1);
    getStage().setDesignMode(false);
    await shouldHappen(() => !host.querySelector('.ticl-d-selection-layer'));
    await waitFrames();
    measure.mockClear();
    page.dispatchEvent(new Event('scroll'));
    first.dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
    await waitFrames();
    expect(reads(first)).toBe(0);
  });

  it('draws transformed corners, watches ancestors, and batches selections across different parents', async () => {
    const {a, b, page, host, selected, getStage} = await createPage();
    const first = page.querySelector<HTMLElement>('#first');
    first.style.position = 'relative';
    getStage().select([a]);
    await shouldHappen(() => selected().length === 1);
    const before = selected()[0].getAttribute('points');
    const parent = first.parentElement;
    parent.style.transformOrigin = '0 0';
    parent.style.transform = 'rotate(20deg)';
    await shouldHappen(() => selected()[0].getAttribute('points') !== before);

    function expectCorners(outline: SVGPolygonElement, element: HTMLElement, width: number, height: number) {
      const origin = host.getBoundingClientRect();
      for (const [i, [x, y]] of [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ].entries()) {
        const marker = document.createElement('div');
        marker.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;`;
        element.appendChild(marker);
        const actual = marker.getBoundingClientRect();
        const point = outline.points.getItem(i);
        expect(point.x + host.clientLeft - host.scrollLeft).toBeCloseTo(actual.left - origin.left, 1);
        expect(point.y + host.clientTop - host.scrollTop).toBeCloseTo(actual.top - origin.top, 1);
        marker.remove();
      }
    }
    expectCorners(selected()[0], first, 100, 40);
    parent.style.transform = 'rotateY(25deg)';
    parent.style.transformStyle = 'preserve-3d';
    parent.style.perspective = '500px';
    const rotated = selected()[0].getAttribute('points');
    await shouldHappen(() => selected()[0].getAttribute('points') !== rotated);
    expectCorners(selected()[0], first, 100, 40);

    b.setValue('#is', 'react:div');
    b.setValue('style', {position: 'relative', width: 120, height: 40, transform: 'rotate(-15deg)'});
    const inner = b.createBlock('inner');
    inner.setValue('#is', 'react:p');
    inner.setValue('#optional', ['id']);
    inner.setValue('id', 'nested-selection');
    inner.setValue('style', {position: 'absolute', left: 10, top: 5, width: 40, height: 25, margin: 0});
    b.setValue('#order', ['inner']);
    await shouldHappen(() => page.querySelector('#nested-selection'));
    getStage().select([a, inner]);
    await shouldHappen(() => selected().length === 2);
    expectCorners(selected()[0], first, 100, 40);
    expectCorners(selected()[1], page.querySelector<HTMLElement>('#nested-selection'), 40, 25);
    const points = [...selected()].map((outline) => outline.getAttribute('points'));
    host.parentElement.style.transform = 'rotate(15deg)';
    await waitFrames();
    expect([...selected()].map((outline) => outline.getAttribute('points'))).toEqual(points);
  });

  it('keeps rectangular outlines for inline geometry outside the utility contract', async () => {
    const {a, page, host, selected, getStage} = await createPage();
    const first = page.querySelector<HTMLElement>('#first');
    first.style.display = 'inline';
    getStage().select([a]);
    await shouldHappen(() => selected().length === 1);
    const bounds = first.getBoundingClientRect();
    const origin = host.getBoundingClientRect();
    expect(selected()[0].points.getItem(0).x).toBeCloseTo(bounds.left - origin.left, 2);
    expect(selected()[0].points.getItem(1).x - selected()[0].points.getItem(0).x).toBeCloseTo(bounds.width, 2);
  });

  it('draws all instances of a selected block while keeping repeated stages independent', async () => {
    const flow = Root.instance.addFlow(path, {'#main': {'#is': 'react:div'}});
    const main = flow.getValue('#main') as Block;
    const child = main.createBlock('child');
    child.setValue('#is', 'react:p');
    child.setValue('content', 'Repeated');
    const contexts = new Map<ElementMap, React.ContextType<typeof ComponentContext>>();
    function Probe() {
      const context = React.useContext(ComponentContext);
      contexts.set(context.elementMap, context);
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
    await shouldHappen(() => contexts.size === 2 && div.querySelectorAll('p').length === 4);
    await waitFrames();
    const [first, second] = div.querySelectorAll('.ticl-d-stage');
    const [firstMap, secondMap] = contexts.keys();
    contexts.get(firstMap).select([child]);
    await shouldHappen(() => first.querySelectorAll('.ticl-d-selection-rect').length === 2);
    expect(second.querySelectorAll('.ticl-d-selection-rect').length).toBe(0);
    expect(firstMap.getElements(child).every((element) => first.contains(element))).toBe(true);
    expect(secondMap.getElements(child).every((element) => second.contains(element))).toBe(true);
  });
});
