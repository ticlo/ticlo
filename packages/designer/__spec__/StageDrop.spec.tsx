import React, {StrictMode} from 'react';
import {vi} from 'vitest';
import {DragDrop} from 'rc-dock';
import {Block, BlockOrder, Root, getDefaultFuncData, globalFunctions, type DataMap} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {getElementBoxQuads} from '@ticlo/html';
import {FunctionView} from '@ticlo/editor/function-selector/FunctionView.tsx';
import {loadTemplate, removeLastTemplate} from '@ticlo/editor/util/test-util.ts';
import {DesignerApp} from '../DesignerApp.tsx';
import {DesignerStage} from '../DesignerStage.tsx';
import {useActiveDesignerStage, type DesignerStageContextValue} from '../DesignerContext.tsx';
import type {DesignerDropHandlers} from '../StageDrop.ts';
import '../style/index.css';
import '../../react/style/index.css';
import '../../editor/style/index.css';

describe('designer stage drops', () => {
  const path = 'StageDropTest';
  afterEach(() => {
    document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue(path);
    vi.restoreAllMocks();
  });

  async function mount(data: DataMap, handlers: DesignerDropHandlers = {}, source: DataMap | string = 'react:div') {
    const desc = globalFunctions.getDescToSend(typeof source === 'string' ? source : (source['#is'] as string))[0];
    const flow = Root.instance.addFlow(
      path,
      {'#main': {'#is': 'react:div', 'style': {position: 'relative', width: 500, height: 300}, ...data}},
      {applyChange: (flow) => flow.save()}
    );
    const main = flow.getValue('#main') as Block;
    const [server, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    let stage: DesignerStageContextValue;
    function Panel(): null {
      stage = useActiveDesignerStage();
      return null;
    }
    const [, div] = loadTemplate(
      <StrictMode>
        <DesignerApp value={{}}>
          <div style={{width: 650, height: 500}}>
            <DesignerStage root={Root.instance} conn={conn} basePath={path} {...handlers} />
          </div>
          <FunctionView conn={conn} desc={desc} data={typeof source === 'string' ? undefined : source} />
          <DragDrop
            className="binding-drag"
            onDragStartT={(event) => {
              event.setData({fields: ['data.value']}, conn.getBaseConn());
              event.startDrag();
            }}
          >
            Binding
          </DragDrop>
          <Panel />
        </DesignerApp>
      </StrictMode>
    );
    await shouldHappen(() => stage?.main === main && div.querySelector('.ticl-d-page > div'));
    const host = div.querySelector<HTMLElement>('.ticl-d-stage');
    const page = div.querySelector<HTMLElement>('.ticl-d-page > div');
    const element = (id: string) => div.querySelector<HTMLElement>(`#${id}`);
    const outline = () => host.querySelector<SVGPolygonElement>('.ticl-d-drop-rect');
    const move = (target: Element, x: number, y: number, type = 'mousemove') =>
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: type === 'mouseup' ? 0 : 1,
          clientX: x,
          clientY: y,
        })
      );
    const begin = (binding = false) => {
      const from = div.querySelector<HTMLElement>(binding ? '.binding-drag' : '.ticl-e-func-view');
      const rect = from.getBoundingClientRect();
      move(from, rect.left + 5, rect.top + 5, 'mousedown');
      move(document.documentElement, rect.left + 8, rect.top + 5);
    };
    const dragTo = (target: Element, offsetX = 10, offsetY = 10) => {
      const rect = target.getBoundingClientRect();
      move(target, rect.left + offsetX, rect.top + offsetY);
      return () => move(target, rect.left + offsetX, rect.top + offsetY, 'mouseup');
    };
    return {flow, main, conn, server, div, host, page, element, outline, move, begin, dragTo, getStage: () => stage};
  }

  function child(id: string, style: DataMap = {}, extra: DataMap = {}): DataMap {
    return {'#is': 'react:img', '#optional': ['id'], id, 'style': {width: 60, height: 40, ...style}, ...extra};
  }

  function expectQuad(outline: SVGPolygonElement, quad: DOMQuad) {
    [quad.p1, quad.p2, quad.p3, quad.p4].forEach((point, index) => {
      expect(outline.points.getItem(index).x).toBeCloseTo(point.x, 2);
      expect(outline.points.getItem(index).y).toBeCloseTo(point.y, 2);
    });
  }

  it('leaves forwarded order and its owner unchanged on a function drop', async () => {
    const {flow, main, conn, page, element, outline, begin, dragTo} = await mount({
      '#is': 'react:horizontal',
      'owner': {
        '#is': 'react:horizontal',
        '#order': ['a', 'b'],
        'a': child('forwarded-a'),
        'b': child('forwarded-b'),
      },
    });
    const owner = main.getValue('owner') as Block;
    flow.createBlock('#inputs').setValue('#custom', [{name: '#order', type: 'array'}]);
    flow.updateInput(owner);
    main.setBinding('#order', '##.#inputs.#order');
    await shouldHappen(() => element('forwarded-b'));
    const add = vi.spyOn(conn, 'addBlock');
    begin();
    const drop = dragTo(element('forwarded-b'), 1, 10);
    expect(outline()).toBeNull();
    drop();
    expect(add).not.toHaveBeenCalled();
    expect(owner.getValue('div')).toBeUndefined();
    expect(owner.getValue('#order')).toEqual(['a', 'b']);
    expect(main.getValue('div')).toBeUndefined();
    expect(main.getValue('#order')).toBeInstanceOf(BlockOrder);
    expect((main.getValue('#order') as BlockOrder).owner).toBe(owner);
    expect(page.children.length).toBe(2);
  });

  it('outlines the nearest compatible ancestor of the frontmost hit, follows transforms, and selects unique new children', async () => {
    const source = {'#is': 'react:div', 'content': 'new child'};
    const {main, conn, host, element, outline, begin, dragTo, getStage} = await mount(
      {
        '#order': ['container'],
        'container': child(
          'container',
          {width: 250, height: 180, transform: 'rotate(12deg) scale(.9)', transformOrigin: '0 0'},
          {
            '#is': 'react:div',
            '#order': ['leaf'],
            'leaf': child('leaf'),
          }
        ),
      },
      {},
      source
    );
    const container = main.getValue('container') as Block;
    const changes = vi.fn();
    conn.childrenChangeStream().listen(changes);
    for (const name of ['div', 'div1']) {
      begin();
      const finish = dragTo(element('leaf'), 20, 20);
      await shouldHappen(outline);
      expectQuad(outline(), getElementBoxQuads([element('container')], host).get(element('container')));
      finish();
      await shouldHappen(() => container.getValue(name) instanceof Block);
      await shouldHappen(() => getStage().selection.paths[0] === `${container.getFullPath()}.${name}`);
      await shouldHappen(() => !outline());
    }
    expect(container.getValue('#order')).toEqual(['leaf', 'div', 'div1']);
    expect(changes).toHaveBeenCalledWith({path: container.getFullPath(), showNode: true});
    expect(source).toEqual({'#is': 'react:div', 'content': 'new child'});
    expect((container.getValue('div') as Block)._save()).not.toHaveProperty('@b-xyw');
  });

  it.each(['rotate(20deg) scale(1.1,.8)', 'perspective(700px) rotateY(20deg)'])(
    'centers an initialized 200x200 absolute child on the pointer through borders, scrolling, zoom and %s',
    async (transform) => {
      const initial = getDefaultFuncData(globalFunctions.getDescToSend('react:horizontal')[0]);
      const source = {...initial, style: {...(initial.style as DataMap), position: 'relative', backgroundColor: 'red'}};
      const {main, host, page, outline, begin, move, getStage} = await mount(
        {
          '#is': 'react:absolute',
          'style': {
            width: 400,
            height: 250,
            border: '8px solid black',
            overflow: 'auto',
            zoom: 1.2,
            transform,
            transformOrigin: '0 0',
          },
          '#order': ['large'],
          'large': child('large', {left: 0, top: 0, width: 600, height: 400}),
        },
        {},
        source
      );
      host.parentElement.style.zoom = '1.25';
      page.scrollLeft = 20;
      page.scrollTop = 15;
      const marker = document.createElement('div');
      marker.style.cssText = 'position:absolute;left:190px;top:170px;width:0;height:0;';
      page.appendChild(marker);
      const point = marker.getBoundingClientRect();
      begin();
      move(page, point.left, point.top);
      await shouldHappen(outline);
      const preview = outline().cloneNode(true) as SVGPolygonElement;
      move(page, point.left, point.top, 'mouseup');
      await shouldHappen(() => main.getValue('horizontal') instanceof Block);
      const added = main.getValue('horizontal') as Block;
      const style = added.getValue('style') as DataMap;
      // MouseEvent coordinates are integral viewport pixels, even through zoom.
      expect(Math.abs((style.left as number) - 90)).toBeLessThan(1);
      expect(Math.abs((style.top as number) - 70)).toBeLessThan(1);
      expect(style.width).toBe(200);
      expect(style.height).toBe(200);
      expect(style.position).toBe('absolute');
      expect(style.backgroundColor).toBe('red');
      await shouldHappen(() => getStage().elementMap.getElements(added)?.length);
      const rendered = getStage().elementMap.getElements(added)[0];
      expectQuad(preview, getElementBoxQuads([rendered], host).get(rendered));
      expect(source.style).toEqual({width: 200, height: 200, position: 'relative', backgroundColor: 'red'});
      getStage().undo();
      await shouldHappen(() => !main.getValue('horizontal'));
      expect(main.getValue('#order')).toEqual(['large']);
      marker.remove();
    }
  );

  it.each(['absolute', 'horizontal', 'vertical', 'view-deck'])(
    'creates a %s layout with its initial 200x200 style',
    async (layout) => {
      const {main, outline, begin, dragTo, page} = await mount({'#is': 'react:absolute'}, {}, `react:${layout}`);
      begin();
      const finish = dragTo(page);
      await shouldHappen(outline);
      const bounds = outline().getBBox();
      expect(bounds.width).toBeCloseTo(200, 3);
      expect(bounds.height).toBeCloseTo(200, 3);
      finish();
      await shouldHappen(() => main.getValue(layout) instanceof Block);
      expect((main.getValue(layout) as Block).getValue('style')).toMatchObject({
        width: 200,
        height: 200,
        left: -90,
        top: -90,
      });
    }
  );

  it.each([undefined, {width: 80}, {height: 60}])(
    'uses preview-only fallback dimensions for initial style %j',
    async (style) => {
      const source: DataMap = {'#is': 'react:div', ...(style ? {style} : {})};
      const {main, outline, begin, dragTo, page} = await mount({'#is': 'react:absolute'}, {}, source);
      begin();
      const finish = dragTo(page);
      await shouldHappen(outline);
      const bounds = outline().getBBox();
      expect(bounds.width).toBeCloseTo(style?.width ?? 100, 3);
      expect(bounds.height).toBeCloseTo(style?.height ?? 100, 3);
      finish();
      await shouldHappen(() => main.getValue('div') instanceof Block);
      const savedStyle = (main.getValue('div') as Block).getValue('style') as DataMap;
      expect(savedStyle.width).toBe(style?.width);
      expect(savedStyle.height).toBe(style?.height);
      expect(savedStyle.left).toBe(10 - (style?.width ?? 100) / 2);
      expect(savedStyle.top).toBe(10 - (style?.height ?? 100) / 2);
      expect(source).toEqual({'#is': 'react:div', ...(style ? {style} : {})});
    }
  );

  it.each(['horizontal', 'vertical'])('uses a full outline for an empty %s layout', async (layout) => {
    const {main, host, page, outline, begin, dragTo} = await mount({'#is': `react:${layout}`});
    begin();
    const finish = dragTo(page);
    await shouldHappen(outline);
    expectQuad(outline(), getElementBoxQuads([page], host).get(page));
    finish();
    await shouldHappen(() => main.getValue('div') instanceof Block);
    expect(main.getValue('#order')).toEqual(['div']);
  });

  it.each([
    {layout: 'horizontal', direction: 'row', before: true},
    {layout: 'horizontal', direction: 'row', before: false},
    {layout: 'vertical', direction: 'column', before: true},
    {layout: 'vertical', direction: 'column', before: false},
    {layout: 'horizontal', direction: 'row-reverse', before: true},
    {layout: 'vertical', direction: 'column-reverse', before: false},
  ])('predicts an insertion in $direction (before=$before)', async ({layout, direction, before}) => {
    const {main, page, element, outline, begin, dragTo} = await mount({
      '#is': `react:${layout}`,
      'style': {width: 400, height: 250, gap: 20, flexDirection: direction},
      '#order': ['missing', 'a', 'b'],
      'a': child('a'),
      'b': child('b'),
    });
    const horizontal = layout === 'horizontal';
    const leading = before !== direction.endsWith('reverse');
    begin();
    const finish = dragTo(element('b'), horizontal ? (leading ? 5 : 55) : 20, horizontal ? 20 : leading ? 5 : 35);
    await shouldHappen(outline);
    const bounds = outline().getBBox();
    expect(horizontal ? bounds.width : bounds.height).toBeCloseTo(6, 3);
    expect(horizontal ? bounds.height : bounds.width).toBeCloseTo(horizontal ? 40 : 60, 3);
    finish();
    await shouldHappen(() => main.getValue('div') instanceof Block);
    expect(main.getValue('#order')).toEqual(before ? ['missing', 'a', 'div', 'b'] : ['missing', 'a', 'b', 'div']);
    expect(page.contains(element('b'))).toBe(true);
  });

  it('does not reach a container behind the frontmost leaf', async () => {
    const {main, element, outline, begin, dragTo} = await mount({
      '#order': ['back', 'front'],
      'back': child('back', {position: 'absolute', width: 200, height: 100}, {'#is': 'react:div'}),
      'front': child('front', {position: 'absolute', width: 200, height: 100}),
    });
    begin();
    const finish = dragTo(element('front'));
    await shouldHappen(outline);
    finish();
    await shouldHappen(() => main.getValue('div') instanceof Block);
    expect((main.getValue('back') as Block).getValue('div')).toBeUndefined();
  });

  it.each(['horizontal', 'vertical'])(
    'inserts after a content component in a %s layout without #order',
    async (layout) => {
      const {main, element, outline, begin, dragTo} = await mount({
        '#is': `react:${layout}`,
        'content': child('content'),
      });
      begin();
      const finish = dragTo(element('content'));
      await shouldHappen(outline);
      const bounds = outline().getBBox();
      expect(layout === 'horizontal' ? bounds.width : bounds.height).toBeCloseTo(6, 3);
      finish();
      await shouldHappen(() => main.getValue('div') instanceof Block);
      expect(main.getValue('#order')).toEqual(['div']);
      expect(main.getValue('content')).toBeInstanceOf(Block);
    }
  );

  it('ignores incompatible function drags without blocking extension callbacks', async () => {
    const onDragOverT = vi.fn<DesignerDropHandlers['onDragOverT']>(() => false);
    const {conn, page, outline, begin, dragTo} = await mount({}, {onDragOverT}, {'#is': 'add'});
    const add = vi.spyOn(conn, 'addBlock');
    begin();
    const finish = dragTo(page);
    await shouldHappen(() => onDragOverT.mock.calls.length);
    expect(outline()).toBeNull();
    finish();
    expect(add).not.toHaveBeenCalled();
  });

  it('delivers binding drags and drops to extension handlers on a leaf component', async () => {
    const onDragOverT = vi.fn<DesignerDropHandlers['onDragOverT']>(() => true);
    const onDropT = vi.fn<DesignerDropHandlers['onDropT']>(() => true);
    const {main, conn, element, outline, begin, dragTo} = await mount(
      {
        '#order': ['leaf'],
        'leaf': child('leaf'),
      },
      {onDragOverT, onDropT}
    );
    const add = vi.spyOn(conn, 'addBlock');
    begin(true);
    const finish = dragTo(element('leaf'));
    await shouldHappen(() => onDragOverT.mock.calls.length);
    expect(onDragOverT.mock.calls.at(-1)[1]).toEqual({block: main.getValue('leaf'), element: element('leaf')});
    expect(outline()).toBeNull();
    finish();
    expect(onDropT.mock.calls.at(-1)[1]).toEqual({block: main.getValue('leaf'), element: element('leaf')});
    expect(add).not.toHaveBeenCalled();
  });

  it('rechecks edit policy at release and clears feedback on leaving or entering preview', async () => {
    const {main, conn, server, div, page, outline, begin, dragTo, getStage} = await mount({});
    const add = vi.spyOn(conn, 'addBlock');
    begin();
    let finish = dragTo(page);
    await shouldHappen(outline);
    server.setEditPolicy({denyProps: ['#order']});
    await shouldHappen(() => conn.getEditPolicyView().policy?.denyProps?.includes('#order'));
    finish();
    expect(add).not.toHaveBeenCalled();
    await shouldHappen(() => !outline());
    begin();
    finish = dragTo(page);
    expect(outline()).toBeNull();
    finish();
    server.setEditPolicy(null);
    await shouldHappen(() => !conn.getEditPolicyView().policy?.denyProps);
    begin();
    dragTo(page);
    await shouldHappen(outline);
    dragTo(div.querySelector('.binding-drag'));
    await shouldHappen(() => !outline());
    finish = dragTo(page);
    await shouldHappen(outline);
    getStage().setDesignMode(false);
    await shouldHappen(() => !getStage().designMode && !outline());
    finish();
    expect(add).not.toHaveBeenCalled();
    expect(main.getValue('div')).toBeUndefined();
  });
});
