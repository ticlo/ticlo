import React from 'react';
import {vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import '../style/index.css';
import '../../react/style/index.css';
import {Block, BlockOrder, Root, type DataMap} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {loadTemplate, removeLastTemplate} from '@ticlo/editor/util/test-util.ts';
import {DesignerApp} from '../DesignerApp.tsx';
import {DesignerStage} from '../DesignerStage.tsx';
import {useActiveDesignerStage, type DesignerStageContextValue} from '../DesignerContext.tsx';
import {getElementGeometry} from '@ticlo/html';
import {projectPoint} from '../StageGeometry.ts';
import {resizeHandles} from '../StageResize.ts';

function pointer(target: EventTarget, type: string, x = 0, y = 0, ctrlKey = false) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      isPrimary: true,
      pointerId: 1,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: x,
      clientY: y,
      ctrlKey,
    })
  );
}

function click(element: Element, ctrlKey = false) {
  const rect = element.getBoundingClientRect();
  pointer(element, 'pointerdown', rect.left + 2, rect.top + 2, ctrlKey);
  pointer(element, 'pointerup', rect.left + 2, rect.top + 2, ctrlKey);
}

function child(id: string, style: Record<string, unknown> = {}, extra: DataMap = {}): DataMap {
  return {'#is': 'react:p', '#optional': ['id'], id, 'style': {width: 30, height: 20, margin: 0, ...style}, ...extra};
}

describe('designer stage gestures', () => {
  const path = 'StageInputTest';
  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue(path);
    vi.restoreAllMocks();
  });

  async function mount(data: DataMap, zoom = 1, flowData: DataMap = {}) {
    const flow = Root.instance.addFlow(
      path,
      {
        ...flowData,
        '#main': {'#is': 'react:div', 'style': {position: 'relative', width: 300, height: 200}, ...data},
      },
      {applyChange: (flow) => flow.save()}
    );
    const main = flow.getValue('#main') as Block;
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    let stage: DesignerStageContextValue;
    function Panel(): null {
      stage = useActiveDesignerStage();
      return null;
    }
    const [, div] = loadTemplate(
      <DesignerApp value={{}}>
        <div style={{width: 400, height: 300, zoom}}>
          <DesignerStage root={Root.instance} conn={conn} basePath={path} />
        </div>
        <Panel />
      </DesignerApp>
    );
    await shouldHappen(() => stage?.main === main && div.querySelector('.ticl-d-page > div'));
    const page = div.querySelector('.ticl-d-page > div');
    const element = (id: string) => div.querySelector<HTMLElement>(`#${id}`);
    return {flow, main, page, div, element, conn, getStage: () => stage};
  }

  it.each([1, 3])('selects the outer host when clicking inside %s worker boundaries', async (depth) => {
    let component: DataMap = {
      '#is': 'react:div',
      '#optional': ['id'],
      'id': 'worker-root',
      '#order': ['leaf'],
      'leaf': child('worker-leaf'),
    };
    for (let i = 0; i < depth; ++i) {
      component = {
        '#is': 'worker',
        '#use': {
          '#is': {
            '#is': '',
            '#main': component,
            '#outputs': {
              '#is': '',
              '~#return': '##.#main',
            },
          },
        },
      };
    }
    const {main, element, getStage} = await mount({'#order': ['host'], 'host': component});
    await shouldHappen(() => element('worker-leaf'));
    const host = main.getValue('host') as Block;
    expect(getStage().elementMap.getBlock(element('worker-root'))).toBe(host);
    expect(getStage().elementMap.getBlock(element('worker-leaf'))).toBeUndefined();
    click(element('worker-leaf'));
    await shouldHappen(() => getStage().selection.blocks[0] === host);
    expect(getStage().selection.blocks).toEqual([host]);
  });

  it.each([1, 3])('selects, outlines, and moves external children through %s worker boundaries', async (depth) => {
    const bindings = {'~#order': '##.#inputs.#order'};
    let layout: DataMap = {
      '#is': 'react:div',
      '#optional': ['id'],
      'id': 'worker-root',
      'style': {position: 'relative', width: 300, height: 200},
      ...bindings,
    };
    const definition = (main: DataMap): DataMap => ({
      '#is': '',
      '#inputs': {'#is': '', '#custom': [{name: '#order', type: 'array'}]},
      '#desc': {tags: ['react-comp'], childrenTags: ['react-comp']},
      '#main': main,
      '#outputs': {'#is': '', '~#return': '##.#main'},
    });
    for (let i = 1; i < depth; ++i) layout = {'#is': 'worker', '#use': {'#is': definition(layout)}, ...bindings};
    const {main, element, div, getStage} = await mount(
      {
        '#is': ':layout',
        '#order': ['a', 'b'],
        'a': child('a', {position: 'absolute', left: 30, top: 30}),
        'b': child('b', {position: 'absolute', left: 100, top: 100}),
      },
      1,
      {'#functions': {':layout': {type: 'worker', worker: definition(layout)}}}
    );
    const a = main.getValue('a') as Block;
    const b = main.getValue('b') as Block;
    await shouldHappen(() => element('a') && element('b'));
    expect(getStage().elementMap.getBlock(element('worker-root'))).toBe(main);
    expect(getStage().elementMap.getBlock(element('a'))).toBe(a);

    click(element('a'));
    await shouldHappen(() => getStage().selection.blocks[0] === a);
    await shouldHappen(() => div.querySelectorAll('.ticl-d-selection-rect').length === 1);
    click(element('b'), true);
    await shouldHappen(() => getStage().selection.blocks.length === 2);
    expect(getStage().selection.blocks).toEqual([a, b]);

    getStage().select([]);
    await shouldHappen(() => getStage().selection.blocks.length === 0);
    const rect = element('worker-root').getBoundingClientRect();
    pointer(element('worker-root'), 'pointerdown', rect.left + 10, rect.top + 10);
    pointer(document, 'pointermove', rect.left + 80, rect.top + 70);
    pointer(document, 'pointerup', rect.left + 80, rect.top + 70);
    await shouldHappen(() => getStage().selection.blocks[0] === a);
    expect(getStage().selection.blocks).toEqual([a]);

    const childRect = element('a').getBoundingClientRect();
    pointer(element('a'), 'pointerdown', childRect.left + 2, childRect.top + 2);
    pointer(document, 'pointermove', childRect.left + 14, childRect.top + 9);
    pointer(document, 'pointerup', childRect.left + 14, childRect.top + 9);
    expect(a.getProperty('style')._saved).toMatchObject({left: 42, top: 37});
  });

  it('enters and marquee-selects children on the forwarded order owner', async () => {
    const {main, element, getStage} = await mount({
      owner: {
        '#is': 'react:div',
        '#order': ['a'],
        'a': child('forwarded-child', {position: 'absolute', left: 30, top: 30}),
      },
      a: child('shadow-child'),
    });
    const owner = main.getValue('owner') as Block;
    const a = owner.getValue('a') as Block;
    main.updateValue('#order', new BlockOrder(owner, ['a']));
    await shouldHappen(() => element('forwarded-child'));
    expect(element('shadow-child')).toBeNull();
    getStage().select([main]);
    await shouldHappen(() => getStage().selection.blocks[0] === main);
    click(element('forwarded-child'));
    await shouldHappen(() => getStage().selection.blocks[0] === a);
    getStage().select([]);
    await shouldHappen(() => getStage().selection.blocks.length === 0);
    const page = element('forwarded-child').parentElement;
    const rect = page.getBoundingClientRect();
    pointer(page, 'pointerdown', rect.left + 10, rect.top + 10);
    pointer(document, 'pointermove', rect.left + 80, rect.top + 70);
    pointer(document, 'pointerup', rect.left + 80, rect.top + 70);
    await shouldHappen(() => getStage().selection.blocks[0] === a);
  });

  it('delays container clicks, tolerates small movement, toggles Ctrl selections, and prunes other parents on down', async () => {
    const {main, page, element, getStage} = await mount({
      '#order': ['a', 'b'],
      'a': child('a', {width: 60, height: 40}, {'#is': 'react:div', '#order': ['nested'], 'nested': child('nested')}),
      'b': child('b'),
    });
    const a = main.getValue('a') as Block;
    const b = main.getValue('b') as Block;
    const nested = a.getValue('nested') as Block;
    pointer(element('a'), 'pointerdown', 10, 10);
    expect(getStage().selection.blocks).toEqual([]);
    pointer(document, 'pointermove', 12, 11);
    pointer(document, 'pointerup', 12, 11);
    await shouldHappen(() => getStage().selection.blocks[0] === a);
    click(element('b'), true);
    await shouldHappen(() => getStage().selection.blocks.length === 2);
    expect(getStage().selection.blocks).toEqual([a, b]);
    getStage().select([a, b, nested]);
    await shouldHappen(() => getStage().selection.blocks.length === 3);
    const aRect = element('a').getBoundingClientRect();
    pointer(element('a'), 'pointerdown', aRect.left + 35, aRect.top + 25);
    await shouldHappen(() => getStage().selection.blocks.length === 2);
    expect(getStage().selection.blocks).toEqual([a, b]);
    pointer(document, 'pointerup', aRect.left + 35, aRect.top + 25);
    click(element('a'), true);
    await shouldHappen(() => getStage().selection.blocks.length === 1);
    expect(getStage().selection.blocks).toEqual([b]);
    pointer(page, 'pointerdown');
    expect(getStage().selection.blocks).toEqual([b]);
    pointer(document, 'pointerup');
    await shouldHappen(() => getStage().selection.blocks[0] === main);
  });

  it('presses and drags a selected component through an unselected component in front of it', async () => {
    const {main, page, element, getStage} = await mount({
      '#order': ['selected', 'cover'],
      'selected': child('selected', {position: 'absolute', left: 30, top: 30, width: 100, height: 80}),
      'cover': child('cover', {position: 'absolute', left: 30, top: 30, width: 100, height: 80, zIndex: 2}),
    });
    const selected = main.getValue('selected') as Block;
    const cover = main.getValue('cover') as Block;
    const coverStyle = cover.getValue('style');
    getStage().select([selected]);
    await shouldHappen(() => getStage().selection.blocks[0] === selected);
    await userEvent.click(element('cover'), {position: {x: 10, y: 10}});
    expect(getStage().selection.blocks).toEqual([selected]);
    await userEvent.dragAndDrop(element('cover'), page, {
      sourcePosition: {x: 10, y: 10},
      targetPosition: {x: 90, y: 80},
    });
    expect((selected.getProperty('style')._saved as any).left).toBeCloseTo(80, 1);
    expect((selected.getProperty('style')._saved as any).top).toBeCloseTo(70, 1);
    expect(cover.getValue('style')).toBe(coverStyle);
    expect(getStage().selection.blocks).toEqual([selected]);
  });

  it.each([false, true])(
    'resolves overlapping selections by paint order regardless of selection order (%s)',
    async (reverse) => {
      const {main, element, getStage} = await mount({
        '#order': ['front', 'back', 'cover'],
        'front': child('front', {position: 'absolute', left: 30, top: 30, zIndex: 5}),
        'back': child('back', {position: 'absolute', left: 30, top: 30, zIndex: 1}),
        'cover': child('cover', {position: 'absolute', left: 30, top: 30, zIndex: 10}),
      });
      const front = main.getValue('front') as Block;
      const back = main.getValue('back') as Block;
      getStage().select(reverse ? [back, front] : [front, back]);
      await shouldHappen(() => getStage().selection.blocks.length === 2);
      click(element('cover'), true);
      await shouldHappen(() => getStage().selection.blocks.length === 1);
      expect(getStage().selection.blocks).toEqual([back]);
      getStage().select([]);
      await shouldHappen(() => getStage().selection.blocks.length === 0);
      click(element('cover'));
      await shouldHappen(() => getStage().selection.blocks[0] === main.getValue('cover'));
    }
  );

  it('enters a child on release, and prefers a selected child over its selected parent', async () => {
    const {main, element, getStage} = await mount({
      '#order': ['parent'],
      'parent': child(
        'parent',
        {position: 'relative', width: 100, height: 80},
        {'#is': 'react:div', '#order': ['inner'], 'inner': child('inner', {position: 'absolute', left: 30, top: 30})}
      ),
    });
    const parent = main.getValue('parent') as Block;
    const inner = parent.getValue('inner') as Block;
    getStage().select([parent]);
    await shouldHappen(() => getStage().selection.blocks[0] === parent);
    await userEvent.click(element('inner'), {position: {x: 10, y: 7}});
    await shouldHappen(() => getStage().selection.blocks[0] === inner);
    expect(getStage().selection.blocks).toEqual([inner]);
    getStage().select([parent, inner]);
    await shouldHappen(() => getStage().selection.blocks.length === 2);
    await userEvent.click(element('inner'), {position: {x: 10, y: 7}, modifiers: ['Control']});
    await shouldHappen(() => getStage().selection.blocks.length === 1);
    expect(getStage().selection.blocks).toEqual([parent]);
    parent.setValue('@d-seal', true);
    getStage().select([inner]);
    await shouldHappen(() => getStage().selection.blocks[0] === inner);
    await userEvent.click(element('inner'), {position: {x: 10, y: 7}});
    await shouldHappen(() => getStage().selection.blocks[0] === parent);
    expect(getStage().selection.blocks).toEqual([parent]);
  });

  it.each(['pointer', 'mouse', 'native'])(
    'cycles stationary %s clicks through parents and wraps before main',
    async (input) => {
      const {main, element, getStage} = await mount({
        '#order': ['parent'],
        'parent': child(
          'parent',
          {position: 'relative', width: 150, height: 100},
          {
            '#is': 'react:div',
            '#order': ['inner'],
            'inner': child(
              'inner',
              {position: 'absolute', left: 30, top: 30, width: 60, height: 40},
              {
                '#is': 'react:div',
                '#order': ['deep'],
                'deep': child('deep', {position: 'absolute', left: 10, top: 10}),
              }
            ),
          }
        ),
      });
      const parent = main.getValue('parent') as Block;
      const inner = parent.getValue('inner') as Block;
      const deep = inner.getValue('deep') as Block;
      getStage().select([parent]);
      await shouldHappen(() => getStage().selection.blocks[0] === parent);
      const rect = element('deep').getBoundingClientRect();
      const press = (type: 'down' | 'up') => {
        if (input === 'pointer') pointer(element('deep'), `pointer${type}`, rect.left + 10, rect.top + 7);
        else
          element('deep').dispatchEvent(
            new MouseEvent(`mouse${type}`, {
              bubbles: true,
              cancelable: true,
              button: 0,
              clientX: rect.left + 10,
              clientY: rect.top + 7,
            })
          );
      };
      for (const [index, expected] of [deep, inner, parent, deep, inner, parent, deep].entries()) {
        if (index === 6) {
          if (input === 'mouse')
            document.dispatchEvent(new MouseEvent('mousemove', {clientX: rect.left + 11, clientY: rect.top + 7}));
          else pointer(document, 'pointermove', rect.left + 11, rect.top + 7);
        }
        if (input === 'native') await userEvent.click(element('deep'), {position: {x: 10, y: 7}});
        else {
          const previous = getStage().selection.blocks;
          press('down');
          if (previous.length) expect(getStage().selection.blocks).toEqual(previous);
          press('up');
        }
        await shouldHappen(() => getStage().selection.blocks[0] === expected);
        expect(getStage().selection.blocks).toEqual([expected]);
      }
    }
  );

  it('resets click cycling after any movement, including moving away and back or during a small click', async () => {
    const {main, element, getStage} = await mount({
      '#order': ['parent'],
      'parent': child(
        'parent',
        {position: 'absolute', left: 0, top: 0, width: 100, height: 80},
        {
          '#is': 'react:div',
          '#order': ['inner'],
          'inner': child('inner', {position: 'absolute', left: 30, top: 30}),
        }
      ),
    });
    const parent = main.getValue('parent') as Block;
    const inner = parent.getValue('inner') as Block;
    click(element('inner'));
    await shouldHappen(() => getStage().selection.blocks[0] === inner);
    click(element('inner'));
    await shouldHappen(() => getStage().selection.blocks[0] === parent);
    const rect = element('inner').getBoundingClientRect();
    pointer(document, 'pointermove', rect.left + 3, rect.top + 2);
    pointer(document, 'pointermove', rect.left + 2, rect.top + 2);
    click(element('inner'));
    await shouldHappen(() => getStage().selection.blocks[0] === inner);
    click(element('inner'));
    await shouldHappen(() => getStage().selection.blocks[0] === parent);
    pointer(element('inner'), 'pointerdown', rect.left + 2, rect.top + 2);
    pointer(document, 'pointermove', rect.left + 3, rect.top + 2);
    pointer(document, 'pointermove', rect.left + 2, rect.top + 2);
    pointer(document, 'pointerup', rect.left + 2, rect.top + 2);
    await shouldHappen(() => getStage().selection.blocks[0] === inner);
    click(element('inner'));
    expect(getStage().selection.blocks).toEqual([inner]);
    click(element('inner'));
    await shouldHappen(() => getStage().selection.blocks[0] === parent);
    pointer(element('inner'), 'pointerdown', rect.left + 2, rect.top + 2);
    pointer(document, 'pointermove', rect.left + 22, rect.top + 2);
    pointer(document, 'pointermove', rect.left + 2, rect.top + 2);
    pointer(document, 'pointerup', rect.left + 2, rect.top + 2);
    expect(getStage().selection.blocks).toEqual([parent]);
    click(element('inner'));
    await shouldHappen(() => getStage().selection.blocks[0] === inner);
  });

  it('skips locked parents and wraps to the outermost seal without entering sealed descendants', async () => {
    const {main, element, getStage} = await mount({
      '#order': ['parent'],
      'parent': child(
        'parent',
        {position: 'relative', width: 150, height: 100},
        {
          '#is': 'react:div',
          '#order': ['locked'],
          'locked': child(
            'locked',
            {position: 'relative', width: 100, height: 80},
            {
              '#is': 'react:div',
              '@d-lock': true,
              '#order': ['sealed'],
              'sealed': child(
                'sealed',
                {position: 'relative', width: 60, height: 40},
                {
                  '#is': 'react:div',
                  '@d-seal': true,
                  '#order': ['deep'],
                  'deep': child('deep'),
                }
              ),
            }
          ),
        }
      ),
    });
    const parent = main.getValue('parent') as Block;
    const locked = parent.getValue('locked') as Block;
    const sealed = locked.getValue('sealed') as Block;
    for (const expected of [sealed, parent, sealed, parent]) {
      click(element('deep'));
      await shouldHappen(() => getStage().selection.blocks[0] === expected);
      expect(getStage().selection.blocks).toEqual([expected]);
    }
  });

  it('selects the innermost descendant on a small click, clears siblings, and preserves Ctrl, seals, and Escape', async () => {
    const {main, element, getStage} = await mount({
      '#order': ['parent', 'sibling'],
      'parent': child(
        'parent',
        {position: 'relative', width: 150, height: 100},
        {
          '#is': 'react:div',
          '#order': ['inner'],
          'inner': child(
            'inner',
            {position: 'absolute', left: 30, top: 30, width: 60, height: 40},
            {
              '#is': 'react:div',
              '#order': ['deep'],
              'deep': child('deep', {position: 'absolute', left: 10, top: 10, width: 10, height: 10}),
            }
          ),
        }
      ),
      'sibling': child('sibling'),
    });
    const parent = main.getValue('parent') as Block;
    const sibling = main.getValue('sibling') as Block;
    const inner = parent.getValue('inner') as Block;
    const deep = inner.getValue('deep') as Block;
    const rect = element('deep').getBoundingClientRect();
    getStage().select([parent, sibling]);
    await shouldHappen(() => getStage().selection.blocks.length === 2);
    pointer(element('deep'), 'pointerdown', rect.left + 2, rect.top + 2);
    expect(getStage().selection.blocks).toEqual([parent, sibling]);
    pointer(document, 'pointermove', rect.left + 3, rect.top + 3);
    pointer(document, 'pointerup', rect.left + 3, rect.top + 3);
    await shouldHappen(() => getStage().selection.blocks[0] === deep);
    expect(getStage().selection.blocks).toEqual([deep]);

    getStage().select([parent]);
    await shouldHappen(() => getStage().selection.blocks[0] === parent);
    click(element('deep'), true);
    await shouldHappen(() => getStage().selection.blocks.length === 0);
    getStage().select([parent]);
    await shouldHappen(() => getStage().selection.blocks[0] === parent);
    pointer(element('deep'), 'pointerdown', rect.left + 2, rect.top + 2);
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    pointer(document, 'pointerup', rect.left + 2, rect.top + 2);
    expect(getStage().selection.blocks).toEqual([parent]);
    inner.setValue('@d-lock', true);
    click(element('deep'));
    await shouldHappen(() => getStage().selection.blocks[0] === deep);
    inner.setValue('@d-lock', false);
    inner.setValue('@d-seal', true);
    click(element('deep'));
    await shouldHappen(() => getStage().selection.blocks[0] === inner);
  });

  it('drags a selected movable container from its child and keeps movement latched when returning to the start', async () => {
    const {flow, main, element, getStage} = await mount({
      '#order': ['parent', 'sibling'],
      'parent': child(
        'parent',
        {position: 'absolute', left: 30, top: 30, width: 150, height: 100},
        {
          '#is': 'react:div',
          '#order': ['inner'],
          'inner': child('inner', {position: 'absolute', left: 30, top: 30}),
        }
      ),
      'sibling': child('sibling', {position: 'absolute', left: 220, top: 30}),
    });
    const parent = main.getValue('parent') as Block;
    const sibling = main.getValue('sibling') as Block;
    const inner = parent.getValue('inner') as Block;
    const innerStyle = inner.getValue('style');
    const track = vi.spyOn(flow, 'trackChange');
    getStage().select([parent, sibling]);
    await shouldHappen(() => getStage().selection.blocks.length === 2);
    let rect = element('inner').getBoundingClientRect();
    pointer(element('inner'), 'pointerdown', rect.left + 2, rect.top + 2);
    pointer(document, 'pointermove', rect.left + 22, rect.top + 17);
    pointer(document, 'pointerup', rect.left + 22, rect.top + 17);
    expect(parent.getProperty('style')._saved).toMatchObject({left: 50, top: 45});
    expect(sibling.getProperty('style')._saved).toMatchObject({left: 240, top: 45});
    expect(inner.getValue('style')).toBe(innerStyle);
    expect(getStage().selection.blocks).toEqual([parent, sibling]);
    await shouldHappen(() => getComputedStyle(element('parent')).left === '50px');
    rect = element('inner').getBoundingClientRect();
    pointer(element('inner'), 'pointerdown', rect.left + 2, rect.top + 2);
    pointer(document, 'pointermove', rect.left + 22, rect.top + 17);
    pointer(document, 'pointermove', rect.left + 2, rect.top + 2);
    pointer(document, 'pointerup', rect.left + 2, rect.top + 2);
    expect(getStage().selection.blocks).toEqual([parent, sibling]);
    expect(parent.getProperty('style')._saved).toMatchObject({left: 50, top: 45});
    expect(track).toHaveBeenCalledTimes(1);
  });

  it.each([
    {onChild: false, bound: false},
    {onChild: true, bound: false},
    {onChild: false, bound: true},
    {onChild: true, bound: true},
  ])('marquee-selects children of a selected immovable container (%j)', async ({onChild, bound}) => {
    const style = {position: bound ? 'absolute' : 'relative', left: 30, top: 30, width: 150, height: 100, margin: 0};
    const {flow, main, div, element, getStage} = await mount({
      '#order': ['parent', 'sibling'],
      'sharedStyle': style,
      'parent': child('parent', style, {
        '#is': 'react:div',
        '#order': ['inner'],
        'inner': child('inner', {position: 'absolute', left: 30, top: 30}),
        ...(bound ? {'~style': '##.sharedStyle'} : {}),
      }),
      'sibling': child('sibling'),
    });
    const parent = main.getValue('parent') as Block;
    const inner = parent.getValue('inner') as Block;
    const saved = flow.save();
    getStage().select([parent, main.getValue('sibling') as Block]);
    await shouldHappen(() => getStage().selection.blocks.length === 2);
    const rect = element('parent').getBoundingClientRect();
    const start = onChild ? 32 : 10;
    pointer(element(onChild ? 'inner' : 'parent'), 'pointerdown', rect.left + start, rect.top + start);
    pointer(document, 'pointermove', rect.left + 42, rect.top + 42);
    await shouldHappen(() => div.querySelector('.ticl-d-marquee-rect'));
    expect(getStage().selection.blocks).toEqual([parent, main.getValue('sibling')]);
    pointer(document, 'pointerup', rect.left + 42, rect.top + 42);
    await shouldHappen(() => getStage().selection.blocks[0] === inner);
    expect(getStage().selection.blocks).toEqual([inner]);
    expect(flow.save()).toEqual(saved);
    expect(flow.getValue('@has-undo')).toBeUndefined();
    expect(div.querySelector('.ticl-d-marquee-rect')).toBeNull();
  });

  it('selects leaf and sealed components immediately and resolves outer seals without hiding unlocked children of locks', async () => {
    const {main, element, getStage} = await mount({
      '#order': ['locked', 'sealed', 'both', 'leaf'],
      'locked': child('locked', {}, {'@d-lock': true, '#order': ['inner'], 'inner': child('inner')}),
      'sealed': child(
        'sealed',
        {},
        {
          '@d-seal': true,
          '#order': ['inner'],
          'inner': child(
            'sealed-inner',
            {},
            {
              '@d-seal': true,
              '#order': ['deep'],
              'deep': child('deep'),
            }
          ),
        }
      ),
      'both': child('both', {}, {'@d-lock': true, '@d-seal': true, '#order': ['inner'], 'inner': child('hidden')}),
      'leaf': child('leaf', {}, {'#is': 'react:img'}),
    });
    click(element('locked'));
    expect(getStage().selection.blocks).toEqual([]);
    click(element('inner'));
    const locked = main.getValue('locked') as Block;
    await shouldHappen(() => getStage().selection.blocks[0] === locked.getValue('inner'));
    const deepRect = element('deep').getBoundingClientRect();
    pointer(element('deep'), 'pointerdown', deepRect.left + 2, deepRect.top + 2);
    await shouldHappen(() => getStage().selection.blocks[0] === main.getValue('sealed'));
    pointer(document, 'pointerup', deepRect.left + 2, deepRect.top + 2);
    click(element('hidden'));
    expect(getStage().selection.blocks).toEqual([main.getValue('sealed')]);
    const leafRect = element('leaf').getBoundingClientRect();
    pointer(element('leaf'), 'pointerdown', leafRect.left + 2, leafRect.top + 2);
    await shouldHappen(() => getStage().selection.blocks[0] === main.getValue('leaf'));
    pointer(document, 'pointerup', leafRect.left + 2, leafRect.top + 2);
    pointer(element('locked'), 'pointerover');
    await shouldHappen(() => !element('locked').closest('.ticl-d-stage').querySelector('.ticl-d-hover-rect'));
  });

  it('marquee-selects partially intersecting direct children, skips locks, and adds only siblings', async () => {
    const {main, page, div, element, getStage} = await mount({
      '@d-lock': true,
      '#order': ['a', 'b', 'locked'],
      'a': child('a', {position: 'absolute', left: 30, top: 30}, {'#order': ['nested'], 'nested': child('nested')}),
      'b': child('b', {position: 'absolute', left: 100, top: 100}),
      'locked': child('locked', {position: 'absolute', left: 30, top: 30}, {'@d-lock': true}),
    });
    const origin = page.getBoundingClientRect();
    pointer(page, 'pointerdown', origin.left + 10, origin.top + 10);
    pointer(document, 'pointermove', origin.left + 34, origin.top + 34);
    await shouldHappen(() => div.querySelector('.ticl-d-marquee-rect'));
    pointer(document, 'pointerup', origin.left + 34, origin.top + 34);
    const a = main.getValue('a') as Block;
    await shouldHappen(() => getStage().selection.blocks[0] === a);
    expect(getStage().selection.blocks).toEqual([a]);
    expect(div.querySelector('.ticl-d-marquee-rect')).toBeNull();
    getStage().select([a, a.getValue('nested') as Block]);
    await shouldHappen(() => getStage().selection.blocks.length === 2);
    pointer(page, 'pointerdown', origin.left + 90, origin.top + 90);
    pointer(document, 'pointermove', origin.left + 104, origin.top + 104);
    pointer(document, 'pointerup', origin.left + 104, origin.top + 104, true);
    await shouldHappen(() => getStage().selection.blocks.includes(main.getValue('b') as Block));
    expect(getStage().selection.blocks).toEqual([a, main.getValue('b')]);
    expect(element('nested')).not.toBeNull();
  });

  it('moves writable absolute siblings by the reference delta through ancestor zoom and scale, and saves only on up', async () => {
    const {flow, main, element, div, conn, getStage} = await mount(
      {
        'style': {
          position: 'relative',
          width: 300,
          height: 200,
          zoom: 1.25,
          transform: 'scale(1.2, .8)',
          transformOrigin: '0 0',
        },
        '#order': ['a', 'b', 'static', 'bound'],
        'a': child('a', {position: 'absolute', left: 10, top: 20, zoom: 2, transform: 'scale(1.2)'}),
        'b': child('b', {position: 'absolute', right: 30, bottom: 20, zoom: 3}),
        'static': child('static'),
        'bound': child('bound', {}, {'~style': '##.sharedStyle'}),
        'sharedStyle': {position: 'absolute', left: 100, top: 100, width: 30, height: 20},
      },
      1.5
    );
    const a = main.getValue('a') as Block;
    const b = main.getValue('b') as Block;
    getStage().select([a, b, main.getValue('static') as Block, main.getValue('bound') as Block]);
    await shouldHappen(() => getStage().selection.blocks.length === 4);
    const staticStyle = (main.getValue('static') as Block).getValue('style');
    const saved = flow.save();
    const track = vi.spyOn(flow, 'trackChange');
    const connectionSet = vi.spyOn(conn, 'setValue');
    const append = vi.spyOn(element('a').parentElement, 'appendChild');
    const before = element('a').getBoundingClientRect();
    pointer(element('a'), 'pointerdown', before.left + 2, before.top + 2);
    pointer(document, 'pointermove', before.left + 47, before.top + 32);
    await expect.poll(() => (a.getValue('style') as any).left).toBeCloseTo(20, 4);
    expect((a.getValue('style') as any).top).toBeCloseTo(30);
    expect((b.getValue('style') as any).right).toBeCloseTo(20);
    expect((b.getValue('style') as any).bottom).toBeCloseTo(10);
    expect((b.getValue('style') as any).left).toBeUndefined();
    expect(flow.save()).toEqual(saved);
    expect(track).not.toHaveBeenCalled();
    expect(flow.getValue('@has-undo')).toBeUndefined();
    await shouldHappen(() => Math.abs(element('a').getBoundingClientRect().left - before.left - 45) < 0.1);
    await shouldHappen(() => div.querySelectorAll('.ticl-d-selection-rect').length === 4);
    const host = div.querySelector<HTMLElement>('.ticl-d-stage');
    const rect = div.querySelector<SVGPolygonElement>('.ticl-d-selection-rect');
    await shouldHappen(
      () =>
        Math.abs(
          rect.points.getItem(0).x -
            (element('a').getBoundingClientRect().left - host.getBoundingClientRect().left) / 1.5
        ) < 0.1
    );
    pointer(document, 'pointerup', before.left + 47, before.top + 32);
    expect(track).toHaveBeenCalledTimes(1);
    expect(append).not.toHaveBeenCalled();
    expect(connectionSet).not.toHaveBeenCalled();
    expect((main.getValue('static') as Block).getValue('style')).toBe(staticStyle);
    expect((main.getValue('bound') as Block).getProperty('style')._bindingPath).toBe('##.sharedStyle');
    getStage().undo();
    await shouldHappen(() => (a.getValue('style') as any).left === 10);
    getStage().redo();
    await expect.poll(() => (a.getValue('style') as any).left).toBeCloseTo(20, 4);
  });

  it('moves an unselected leaf immediately and resolves percentage and calc insets to pixels without jumping', async () => {
    const {flow, main, element, getStage} = await mount({
      '#order': ['a'],
      'a': child(
        'a',
        {position: 'absolute', left: '10%', top: 'calc(20% + 5px)', transform: 'rotate(45deg)'},
        {'#is': 'react:img'}
      ),
    });
    const a = main.getValue('a') as Block;
    const before = element('a').getBoundingClientRect();
    const saved = flow.save();
    pointer(element('a'), 'pointerdown', before.left + 2, before.top + 2);
    await shouldHappen(() => getStage().selection.blocks[0] === a);
    pointer(document, 'pointermove', before.left + 22, before.top + 17);
    await expect.poll(() => (a.getValue('style') as any).left).toBeCloseTo(50, 4);
    expect((a.getValue('style') as any).top).toBeCloseTo(60, 4);
    expect(flow.save()).toEqual(saved);
    await shouldHappen(() => Math.abs(element('a').getBoundingClientRect().left - before.left - 20) < 0.1);
    pointer(document, 'pointerup', before.left + 22, before.top + 17);
    expect(a.getProperty('style')._saved).toMatchObject({left: 50, top: 60});
  });

  it.each(['rotate(25deg) scale(1.2,.8)', 'perspective(600px) rotateY(25deg)'])(
    'keeps the grabbed point under the pointer through %s and cancels both selected objects',
    async (transform) => {
      const {main, element, getStage} = await mount(
        {
          'style': {position: 'relative', width: 300, height: 200, transform, transformStyle: 'preserve-3d'},
          '#order': ['a', 'b'],
          'a': child('a', {
            position: 'absolute',
            left: 40,
            top: 50,
            zoom: 1.25,
            transform: 'rotateX(20deg) translateZ(30px)',
          }),
          'b': child('b', {position: 'absolute', left: 150, top: 100, zoom: 2}),
        },
        1.5
      );
      const a = main.getValue('a') as Block;
      const b = main.getValue('b') as Block;
      const savedA = a.getValue('style');
      const savedB = b.getValue('style');
      getStage().select([a, b]);
      await shouldHappen(() => getStage().selection.blocks.length === 2);
      const marker = document.createElement('div');
      marker.style.cssText = 'position:absolute;left:10px;top:7px;width:0;height:0;';
      element('a').appendChild(marker);
      const before = marker.getBoundingClientRect();
      const measure = vi.spyOn(document.documentElement, 'getBoundingClientRect');
      pointer(element('a'), 'pointerdown', before.left, before.top);
      pointer(document, 'pointermove', before.left + 37, before.top + 23);
      await shouldHappen(() => Math.abs(marker.getBoundingClientRect().left - before.left - 37) < 0.02);
      expect(marker.getBoundingClientRect().top - before.top).toBeCloseTo(23, 1);
      expect((b.getValue('style') as any).left - 150).toBeCloseTo((a.getValue('style') as any).left - 40, 4);
      expect((b.getValue('style') as any).top - 100).toBeCloseTo((a.getValue('style') as any).top - 50, 4);
      pointer(document, 'pointermove', before.left + 45, before.top + 35);
      await shouldHappen(() => Math.abs(marker.getBoundingClientRect().left - before.left - 45) < 0.02);
      expect(measure).toHaveBeenCalledTimes(1);
      element('a')
        .closest('.ticl-d-stage')
        .dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      expect(a.getValue('style')).toBe(savedA);
      expect(b.getValue('style')).toBe(savedB);
      await shouldHappen(() => Math.abs(marker.getBoundingClientRect().left - before.left) < 0.02);
    }
  );

  it('marquee tests actual rotated corners instead of the empty part of a bounding rectangle', async () => {
    const {main, page, element, getStage} = await mount({
      '#order': ['a'],
      'a': child('a', {position: 'absolute', left: 100, top: 100, width: 60, height: 60, transform: 'rotate(45deg)'}),
    });
    const bounds = element('a').getBoundingClientRect();
    pointer(page, 'pointerdown', bounds.left + 1, bounds.top + 1);
    pointer(document, 'pointermove', bounds.left + 8, bounds.top + 8);
    pointer(document, 'pointerup', bounds.left + 8, bounds.top + 8);
    expect(getStage().selection.blocks).toEqual([]);
    pointer(page, 'pointerdown', bounds.left + 25, bounds.top + 1);
    pointer(document, 'pointermove', bounds.left + 45, bounds.top + 15);
    pointer(document, 'pointerup', bounds.left + 45, bounds.top + 15);
    await shouldHappen(() => getStage().selection.blocks[0] === main.getValue('a'));
  });

  it.each([{order: undefined}, {order: null}, {order: []}])(
    'selects and moves an unselected container with an empty #order (%j)',
    async ({order}) => {
      const {main, div, element, getStage} = await mount({
        '#order': ['a'],
        'a': child('a', {position: 'absolute', left: 10, top: 20}, {'#is': 'react:div', '#order': order}),
      });
      const a = main.getValue('a') as Block;
      const before = element('a').getBoundingClientRect();
      pointer(element('a'), 'pointerdown', before.left + 2, before.top + 2);
      await shouldHappen(() => getStage().selection.blocks[0] === a);
      pointer(document, 'pointermove', before.left + 22, before.top + 17);
      await expect.poll(() => (a.getValue('style') as any).left).toBeCloseTo(30, 4);
      expect(div.querySelector('.ticl-d-marquee-rect')).toBeNull();
      pointer(document, 'pointerup', before.left + 22, before.top + 17);
      expect(a.getProperty('style')._saved).toMatchObject({left: 30, top: 35});
    }
  );

  it.each([false, true])(
    'blocks content child selection when #order is empty, including through existing selections (locked=%s)',
    async (locked) => {
      const {main, div, element, getStage} = await mount({
        '#order': ['container'],
        'container': child(
          'container',
          {position: 'relative', width: 100, height: 80},
          {
            '#is': 'react:div',
            '#order': [],
            '@d-lock': locked,
            'content': child('inner', {position: 'absolute', left: 30, top: 30}),
          }
        ),
      });
      const container = main.getValue('container') as Block;
      const inner = container.getValue('content') as Block;
      pointer(element('inner'), 'pointerover');
      if (!locked)
        await shouldHappen(() => {
          const outline = div.querySelector<SVGPolygonElement>('.ticl-d-hover-rect');
          return outline && outline.points.getItem(1).x - outline.points.getItem(0).x === 100;
        });
      else expect(div.querySelector('.ticl-d-hover-rect')).toBeNull();
      click(element('inner'));
      if (!locked) await shouldHappen(() => getStage().selection.blocks[0] === container);
      else expect(getStage().selection.blocks).toEqual([]);
      getStage().select([inner]);
      await shouldHappen(() => getStage().selection.blocks[0] === inner);
      click(element('inner'));
      if (!locked) await shouldHappen(() => getStage().selection.blocks[0] === container);
      else expect(getStage().selection.blocks).toEqual([inner]);
    }
  );

  it('uses marquee for an unselected absolute container and movement after it is sealed', async () => {
    const {main, element, getStage} = await mount({
      '#order': ['a'],
      'a': child(
        'a',
        {position: 'absolute', left: 10, top: 20, width: 150, height: 100},
        {
          '#order': ['inner'],
          'inner': child('inner', {position: 'absolute', left: 30, top: 30}),
        }
      ),
    });
    const a = main.getValue('a') as Block;
    const original = a.getValue('style');
    const before = element('a').getBoundingClientRect();
    pointer(element('a'), 'pointerdown', before.left + 1, before.top + 1);
    pointer(document, 'pointermove', before.left + 34, before.top + 34);
    pointer(document, 'pointerup', before.left + 34, before.top + 34);
    await shouldHappen(() => getStage().selection.blocks[0] === a.getValue('inner'));
    expect(a.getValue('style')).toBe(original);
    a.setValue('@d-seal', true);
    pointer(element('inner'), 'pointerdown', before.left + 31, before.top + 31);
    await shouldHappen(() => getStage().selection.blocks[0] === a);
    pointer(document, 'pointermove', before.left + 51, before.top + 41);
    pointer(document, 'pointerup', before.left + 51, before.top + 41);
    expect(a.getProperty('style')._saved).toMatchObject({left: 30, top: 30});
  });

  it('restores the current coordinate binding source and removes preview optional fields on Escape', async () => {
    const {flow, main, element, getStage} = await mount({
      '#order': ['a'],
      'a': child(
        'a',
        {},
        {
          'style': undefined,
          '~style': {
            '#is': 'html:create-style',
            '#optional': ['position', 'left', 'width', 'height'],
            'position': 'absolute',
            '~left': 'origin',
            'origin': 10,
            'width': 30,
            'height': 20,
          },
        }
      ),
    });
    const a = main.getValue('a') as Block;
    const helper = a.getValue('~style') as Block;
    await shouldHappen(() => (a.getValue('style') as any)?.left === 10);
    await shouldHappen(() => getComputedStyle(element('a')).position === 'absolute');
    getStage().select([a]);
    await shouldHappen(() => getStage().selection.blocks.length === 1);
    const saved = flow.save();
    const track = vi.spyOn(flow, 'trackChange');
    pointer(element('a'), 'pointerdown', 10, 10);
    pointer(document, 'pointermove', 30, 25);
    await expect.poll(() => helper.getValue('left')).toBeCloseTo(30, 4);
    expect(helper.getProperty('left')._bindingPath).toBe('origin');
    expect(helper.getValue('#optional')).toContain('top');
    expect(flow.save()).toEqual(saved);
    helper.updateValue('origin', 50);
    pointer(document, 'pointermove', 40, 30);
    await expect.poll(() => helper.getValue('left')).toBeCloseTo(40, 4);
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
    await expect.poll(() => (a.getValue('style') as any).left).toBeCloseTo(50, 4);
    expect(helper.getValue('top')).toBeUndefined();
    expect(helper.getValue('#optional')).toEqual(['position', 'left', 'width', 'height']);
    expect(helper.getProperty('left')._bindingPath).toBe('origin');
    expect(flow.save()).toEqual(saved);
    expect(track).not.toHaveBeenCalled();
    pointer(document, 'pointerup', 40, 30);
  });

  it('commits helper coordinates and optional fields while retaining the owning style binding', async () => {
    const {main, element, getStage} = await mount({
      '#order': ['a'],
      'a': child(
        'a',
        {},
        {
          'style': undefined,
          '~style': {
            '#is': 'html:create-style',
            '#optional': ['position', 'left', 'width', 'height'],
            'position': 'absolute',
            '~left': 'origin',
            'origin': 10,
            'width': 30,
            'height': 20,
          },
        }
      ),
    });
    const a = main.getValue('a') as Block;
    const helper = a.getValue('~style') as Block;
    await shouldHappen(() => (a.getValue('style') as any)?.left === 10);
    await shouldHappen(() => getComputedStyle(element('a')).position === 'absolute');
    getStage().select([a]);
    await shouldHappen(() => getStage().selection.blocks.length === 1);
    pointer(element('a'), 'pointerdown', 10, 10);
    pointer(document, 'pointermove', 30, 25);
    pointer(document, 'pointerup', 35, 30);
    expect(helper.getProperty('left')._bindingPath).toBeNull();
    expect(helper.getProperty('left')._saved).toBe(35);
    expect(helper.getProperty('top')._saved).toBe(20);
    expect(helper.getProperty('#optional')._saved).toContain('top');
    expect(a.getProperty('style')._helperProperty.getValue()).toBe(helper);
  });

  it.each([null, undefined])(
    'previews a missing style (%s) as an object, creates its helper only on up, and merges consecutive drags',
    async (style) => {
      const {flow, main, element, div, getStage} = await mount({
        '#order': ['a'],
        'a': child('a', {}, {style, class: 'stage-missing-style'}),
      });
      const stylesheet = document.createElement('style');
      stylesheet.textContent = '.stage-missing-style {position:absolute;left:40px;top:60px;width:30px;height:20px;}';
      div.appendChild(stylesheet);
      const a = main.getValue('a') as Block;
      getStage().select([a]);
      await shouldHappen(() => getStage().selection.blocks.length === 1);
      const saved = flow.save();
      pointer(element('a'), 'pointerdown', 10, 10);
      pointer(document, 'pointermove', 30, 25);
      await expect.poll(() => (a.getValue('style') as any)?.left).toBeCloseTo(60, 4);
      expect(a.getValue('~style')).toBeUndefined();
      expect(flow.save()).toEqual(saved);
      pointer(document, 'pointercancel', 30, 25);
      expect(a.getValue('style')).toBe(style);
      expect(a.getValue('~style')).toBeUndefined();
      await shouldHappen(() => getComputedStyle(element('a')).left === '40px');
      pointer(element('a'), 'pointerdown', 10, 10);
      pointer(document, 'pointermove', 30, 25);
      pointer(document, 'pointerup', 30, 25);
      const helper = a.getValue('~style') as Block;
      expect(helper.getValue('#is')).toBe('html:create-style');
      expect(helper.getValue('#optional')).toEqual(['left', 'top']);
      await expect.poll(() => (a.getValue('style') as any)?.left).toBeCloseTo(60, 4);
      pointer(element('a'), 'pointerdown', 10, 10);
      pointer(document, 'pointermove', 20, 20);
      pointer(document, 'pointerup', 20, 20);
      expect(a.getValue('~style')).toBe(helper);
      expect(helper.getProperty('left')._saved).toBeCloseTo(70, 4);
      expect(flow._history._tracking).toBe(true);
      getStage().undo();
      await shouldHappen(() => a.getValue('style') === style);
      expect(a.getValue('~style')).toBeUndefined();
      expect(flow.getValue('@has-undo')).toBeUndefined();
    }
  );

  it('cancels pending selection and active movement on Escape, preview mode, window blur, and unmount', async () => {
    const {flow, main, page, element, getStage} = await mount({
      '#order': ['a'],
      'a': child('a', {position: 'absolute', left: 10, top: 20}),
    });
    const a = main.getValue('a') as Block;
    const original = a.getValue('style');
    pointer(page, 'pointerdown');
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    pointer(document, 'pointerup');
    expect(getStage().selection.blocks).toEqual([]);
    getStage().select([a]);
    await shouldHappen(() => getStage().selection.blocks.length === 1);
    for (const reason of ['preview', 'blur', 'unmount']) {
      pointer(element('a'), 'pointerdown', 10, 10);
      pointer(document, 'pointermove', 30, 25);
      await expect.poll(() => (a.getValue('style') as any).left).toBeCloseTo(30, 4);
      if (reason === 'preview') {
        getStage().setDesignMode(false);
        await shouldHappen(() => !getStage().designMode && a.getValue('style') === original);
        getStage().setDesignMode(true);
        await shouldHappen(() => getStage().designMode);
      } else if (reason === 'blur') window.dispatchEvent(new Event('blur'));
      else removeLastTemplate();
      expect(a.getValue('style')).toBe(original);
      expect(flow.getValue('@has-undo')).toBeUndefined();
      if (reason !== 'unmount') await shouldHappen(() => getComputedStyle(element('a')).left === '10px');
    }
  });

  it.each(['rotate(25deg) scale(1.2,.8)', 'perspective(600px) rotateY(25deg)'])(
    'resizes all eight handles through %s, own rotation, zoom, and changing transform origins',
    async (transform) => {
      const style = {
        position: 'absolute',
        left: 40,
        top: 50,
        width: 100,
        height: 60,
        padding: 6,
        border: '2px solid',
        zoom: 1.25,
        transform: 'rotate(30deg)',
      };
      const {main, element, div, getStage} = await mount(
        {
          'style': {position: 'relative', width: 300, height: 200, transform, transformStyle: 'preserve-3d'},
          '#order': ['a'],
          'a': child('a', style),
        },
        1.5
      );
      const a = main.getValue('a') as Block;
      getStage().select([a]);
      const handles = () => div.querySelectorAll<SVGRectElement>('.ticl-d-resize-handle');
      await shouldHappen(() => handles().length === 8);
      for (const handle of resizeHandles) {
        a.setValue('style', {...style, margin: 0});
        await shouldHappen(
          () => getComputedStyle(element('a')).width === '100px' && getComputedStyle(element('a')).height === '60px'
        );
        const before = getElementGeometry([element('a')]).get(element('a'));
        const x = ((handle.x + 1) * 116) / 2;
        const y = ((handle.y + 1) * 76) / 2;
        const start = projectPoint(before.matrix, x, y);
        const end = projectPoint(before.matrix, x + handle.x * 20, y + handle.y * 10);
        const fixed = projectPoint(before.matrix, ((1 - handle.x) * 116) / 2, ((1 - handle.y) * 76) / 2);
        pointer(div.querySelector(`[data-handle="${handle.name}"]`), 'pointerdown', start.x, start.y);
        pointer(document, 'pointermove', end.x, end.y);
        await expect.poll(() => (a.getValue('style') as any).width).toBeCloseTo(handle.x ? 120 : 100, 4);
        await expect.poll(() => (a.getValue('style') as any).height).toBeCloseTo(handle.y ? 70 : 60, 4);
        pointer(document, 'pointerup', end.x, end.y);
        await shouldHappen(() => parseFloat(getComputedStyle(element('a')).width) === (handle.x ? 120 : 100));
        const after = getElementGeometry([element('a')]).get(element('a'));
        const actual = projectPoint(
          after.matrix,
          ((1 - handle.x) * (handle.x ? 136 : 116)) / 2,
          ((1 - handle.y) * (handle.y ? 86 : 76)) / 2
        );
        expect(actual.x).toBeCloseTo(fixed.x, 2);
        expect(actual.y).toBeCloseTo(fixed.y, 2);
      }
    }
  );

  it.each(['left/top', 'right/bottom', 'both', 'neither'])(
    'resizes absolute components using their defined anchors (%s), without writing stretched dimensions',
    async (anchors) => {
      const style = {
        position: 'absolute',
        width: anchors === 'both' ? undefined : 100,
        height: anchors === 'both' ? undefined : 60,
        ...(anchors === 'left/top' || anchors === 'both' ? {left: 40, top: 50} : {}),
        ...(anchors === 'right/bottom' || anchors === 'both' ? {right: 30, bottom: 20} : {}),
      };
      const {flow, main, element, div, getStage} = await mount({'#order': ['a'], 'a': child('a', style)});
      const a = main.getValue('a') as Block;
      getStage().select([a]);
      await shouldHappen(() => div.querySelector('[data-handle="top-left"]'));
      const saved = flow.save();
      const track = vi.spyOn(flow, 'trackChange');
      const start = element('a').getBoundingClientRect();
      pointer(div.querySelector('[data-handle="top-left"]'), 'pointerdown', start.left, start.top);
      pointer(document, 'pointermove', start.left - 20, start.top - 10);
      await expect.poll(() => (a.getValue('style') as any).width).toBe(anchors === 'both' ? undefined : 120);
      expect(flow.save()).toEqual(saved);
      expect(track).not.toHaveBeenCalled();
      pointer(document, 'pointerup', start.left - 20, start.top - 10);
      const changed = a.getValue('style') as any;
      expect(changed.height).toBe(anchors === 'both' ? undefined : 70);
      expect(changed.left).toBe(anchors === 'left/top' || anchors === 'both' ? 20 : undefined);
      expect(changed.top).toBe(anchors === 'left/top' || anchors === 'both' ? 40 : undefined);
      expect(changed.right).toBe(anchors === 'right/bottom' || anchors === 'both' ? 30 : undefined);
      expect(changed.bottom).toBe(anchors === 'right/bottom' || anchors === 'both' ? 20 : undefined);
      expect(track).toHaveBeenCalledTimes(1);
      getStage().undo();
      await shouldHappen(() => (a.getValue('style') as any).width === style.width);
      expect(a.getValue('style')).toMatchObject(style);
      getStage().redo();
      await shouldHappen(() => (a.getValue('style') as any).height === changed.height);
    }
  );

  it('keeps the dragged outline and pointer basis stable through flex wrapping and scrolling', async () => {
    const {main, page, element, div, getStage} = await mount({
      'style': {
        position: 'relative',
        display: 'flex',
        flexWrap: 'wrap',
        alignContent: 'start',
        width: 180,
        height: 700,
      },
      '#order': ['a', 'b'],
      'a': child('a', {width: 80, height: 60, flexShrink: 0}),
      'b': child('b', {width: 80, height: 60, flexShrink: 0}),
    });
    const b = main.getValue('b') as Block;
    getStage().select([b]);
    const outline = () => div.querySelector<SVGPolygonElement>('.ticl-d-selection-rect');
    await shouldHappen(() => outline());
    const before = element('b').getBoundingClientRect();
    const startX = outline().points.getItem(0).x;
    const startY = outline().points.getItem(0).y;
    pointer(div.querySelector('[data-handle="right"]'), 'pointerdown', before.right, before.top + 30);
    pointer(document, 'pointermove', before.right + 50, before.top + 30);
    await shouldHappen(() => element('b').getBoundingClientRect().left < before.left - 50);
    await shouldHappen(() => outline().points.getItem(1).x - outline().points.getItem(0).x === 130);
    expect(outline().points.getItem(0).x).toBe(startX);
    expect(outline().points.getItem(0).y).toBe(startY);
    page.parentElement.scrollTop = 30;
    await new Promise(requestAnimationFrame);
    pointer(document, 'pointermove', before.right + 60, before.top + 30);
    await shouldHappen(() => outline().points.getItem(1).x - outline().points.getItem(0).x === 140);
    expect((b.getValue('style') as any).width).toBe(140);
    expect(outline().points.getItem(0).x).toBe(startX);
    expect(outline().points.getItem(0).y).toBe(startY);
    pointer(document, 'pointerup', before.right + 60, before.top + 30);
    await shouldHappen(() => outline().points.getItem(0).x !== startX);
    const host = div.querySelector<HTMLElement>('.ticl-d-stage');
    expect(outline().points.getItem(0).y).toBeCloseTo(
      element('b').getBoundingClientRect().top - host.getBoundingClientRect().top,
      2
    );
  });

  it('previews helper dimensions, restores current bindings on cancel, and retains the style helper on commit', async () => {
    const {flow, main, element, div, getStage} = await mount({
      '#order': ['a'],
      'a': child(
        'a',
        {},
        {
          'style': undefined,
          'content': 'Sizing',
          '~style': {
            '#is': 'html:create-style',
            '#optional': ['position', 'left', 'top', 'width'],
            'position': 'absolute',
            'left': 40,
            'top': 50,
            '~width': 'source',
            'source': 100,
          },
        }
      ),
    });
    const a = main.getValue('a') as Block;
    const helper = a.getValue('~style') as Block;
    getStage().select([a]);
    await shouldHappen(() => div.querySelector('[data-handle="bottom-right"]'));
    const saved = flow.save();
    const before = element('a').getBoundingClientRect();
    pointer(div.querySelector('[data-handle="bottom-right"]'), 'pointerdown', before.right, before.bottom);
    pointer(document, 'pointermove', before.right + 20, before.bottom + 10);
    await shouldHappen(() => helper.getValue('width') === 120);
    expect(flow.save()).toEqual(saved);
    expect(helper.getValue('#optional')).toContain('height');
    helper.updateValue('source', 140);
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await shouldHappen(() => (a.getValue('style') as any).width === 140);
    expect(helper.getValue('height')).toBeUndefined();
    expect(helper.getValue('#optional')).toEqual(['position', 'left', 'top', 'width']);
    expect(helper.getProperty('width')._bindingPath).toBe('source');
    expect(flow.save()).toEqual(saved);
    await shouldHappen(() => getComputedStyle(element('a')).width === '140px');
    const next = element('a').getBoundingClientRect();
    pointer(div.querySelector('[data-handle="bottom-right"]'), 'pointerdown', next.right, next.bottom);
    pointer(document, 'pointerup', next.right + 20, next.bottom + 10);
    expect(helper.getProperty('width')._bindingPath).toBeNull();
    expect(helper.getProperty('width')._saved).toBe(160);
    expect(a.getProperty('style')._helperProperty.getValue()).toBe(helper);
  });
});
