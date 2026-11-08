import React from 'react';
import {vi} from 'vitest';
import {Flow, Root} from '@ticlo/core';
import type {Block} from '@ticlo/core';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.ts';
import {FlowRoot, useFlow} from '../useFlow.tsx';
import {useFilteredBlocks} from '../useFilteredBlocks.tsx';
import {ComponentContext, ElementMap, useValue} from '../../index.ts';
import {useTicloComp} from '../useTicloComp.ts';
import {useBlockProps} from '../useBlockProps.tsx';
import {useBlockValue} from '../useBlockValue.ts';
import {Values} from '../../comp/Values.ts';

function ValueProbe({block, path, capture}: {block: Block; path: string; capture: {current?: unknown}}) {
  capture.current = useValue(block, path);
  return <span>{typeof capture.current}</span>;
}

function FlowName({capture}: {capture: {current?: Flow}}) {
  const flow = useFlow();
  capture.current = flow;
  return <span>{flow.getName()}</span>;
}

function FilteredBlockNames({block, onRender}: {block: Block; onRender?: () => void}) {
  onRender?.();
  return <span>{Object.keys(useFilteredBlocks(block)).join(',')}</span>;
}

describe('react hooks', function () {
  let root: ReactRoot;

  beforeEach(function () {
    root = creatReactRoot();
  });

  afterEach(function () {
    root.remove();
  });

  it('follows mapped values without refreshing unchanged output or invoking callbacks', async () => {
    const first = new Flow();
    const second = new Flow();
    const callback = vi.fn();
    first.setValue('value', 2.1);
    first.updateValue('callback', callback);
    second.setValue('value', 8);
    const propMap = {count: {name: 'value', value: Values.integer}};
    let renders = 0;
    let currentCallback: unknown;
    function Probe({block}: {block: Block}) {
      ++renders;
      currentCallback = useBlockValue(block, 'callback');
      return <span>{useBlockProps(block, propMap).count}</span>;
    }
    try {
      await root.waitRender(<Probe block={first} />);
      const initial = renders;
      expect(currentCallback).toBe(callback);
      expect(callback).not.toHaveBeenCalled();
      first.setValue('unrelated', 1);
      first.setValue('value', 2.2);
      await root.waitRender();
      expect(renders).toBe(initial);
      first.setValue('value', 3);
      await root.waitRender();
      expect(root.div.textContent).toBe('3');
      await root.waitRender(<Probe block={second} />);
      expect(root.div.textContent).toBe('8');
      expect(currentCallback).toBeUndefined();
      const switched = renders;
      first.setValue('value', 9);
      await root.waitRender();
      expect(renders).toBe(switched);
    } finally {
      await root.waitRender(<></>);
      first.destroy();
      second.destroy();
    }
  });

  it('shares a stable root ref with the page, local object ref, and optional callback in both modes', async () => {
    const flow = new Flow();
    const block = flow.createBlock('component');
    block.setValue('#optional', ['ref']);
    const elementMap = new ElementMap();
    const ref = React.createRef<HTMLDivElement>();
    const cleanup = vi.fn();
    const optionalRef = vi.fn(() => cleanup);
    const options = {ref, optionalHandler: (_block: Block, name: string) => (name === 'ref' ? optionalRef : undefined)};
    function Probe() {
      const {optionalHandlers} = useTicloComp(block, options);
      return <div {...optionalHandlers} />;
    }
    async function render(designMode: boolean) {
      await root.waitRender(
        <ComponentContext.Provider value={{designMode, elementMap, select: () => false, addSelection: () => false}}>
          <Probe />
        </ComponentContext.Provider>
      );
    }
    try {
      await render(true);
      const element = root.div.firstElementChild;
      expect(ref.current).toBe(element);
      expect(elementMap.getBlock(element)).toBe(block);
      expect(optionalRef).toHaveBeenCalledWith(element);
      expect(block.getValue('ref')).toBeUndefined();
      await render(false);
      expect(ref.current).toBe(element);
      expect(elementMap.getBlock(element)).toBe(block);
      expect(optionalRef).toHaveBeenCalledTimes(1);
      expect(cleanup).not.toHaveBeenCalled();
      await root.waitRender(<></>);
      expect(ref.current).toBeNull();
      expect(elementMap.getElements(block).length).toBe(0);
      expect(elementMap.getBlock(element)).toBeUndefined();
      expect(cleanup).toHaveBeenCalledTimes(1);
    } finally {
      flow.destroy();
    }
  });

  it('provides a root ref outside the designer without requiring an optional ref property', async () => {
    const flow = new Flow();
    const ref = vi.fn();
    let handlers: Record<string, unknown>;
    function Probe() {
      const {optionalHandlers} = useTicloComp(flow, {ref});
      handlers = optionalHandlers;
      return <div {...optionalHandlers} />;
    }
    try {
      await root.waitRender(
        <ComponentContext.Provider value={{designMode: false, select: () => false, addSelection: () => false}}>
          <Probe />
        </ComponentContext.Provider>
      );
      const initialHandlers = handlers;
      expect(ref).toHaveBeenCalledWith(root.div.firstElementChild);
      expect(flow.getValue('ref')).toBeUndefined();
      await root.waitRender(
        <ComponentContext.Provider value={{designMode: true, select: () => false, addSelection: () => false}}>
          <Probe />
        </ComponentContext.Provider>
      );
      expect(handlers).toBe(initialHandlers);
      await root.waitRender(<></>);
      expect(ref).toHaveBeenLastCalledWith(null);
    } finally {
      flow.destroy();
    }
  });

  it('preserves optional event handlers in both modes and leaves selection to the designer stage', async () => {
    const flow = new Flow();
    const block = flow.createBlock('component');
    const eventHandlers = [
      'onMouseDown',
      'onMouseDownCapture',
      'onMouseMove',
      'onPointerDown',
      'onDragStart',
      'onWheel',
      'onKeyDown',
      'onFocus',
      'onInput',
      'onPaste',
      'onCompositionStart',
      'onTouchStart',
      'onLoad',
      'onPlay',
      'onScroll',
      'onAnimationEnd',
      'onTransitionEnd',
    ];
    block.setValue('#optional', ['id', 'ref', 'onClick', ...eventHandlers]);
    block.setValue('id', 'selection-test');
    const onClick = vi.fn();
    const select = vi.fn(() => true);
    const addSelection = vi.fn(() => true);
    const options = {optionalHandler: (_block: Block, name: string) => (name === 'onClick' ? onClick : undefined)};
    function Probe() {
      const {optionalHandlers} = useTicloComp(block, options);
      return (
        <>
          <button {...optionalHandlers}>component</button>
          <img onLoad={optionalHandlers?.onLoad as React.ReactEventHandler<HTMLImageElement>} />
          <video onPlay={optionalHandlers?.onPlay as React.ReactEventHandler<HTMLVideoElement>} />
        </>
      );
    }
    async function render(designMode: boolean) {
      await root.waitRender(
        <ComponentContext.Provider value={{designMode, select, addSelection}}>
          <Probe />
        </ComponentContext.Provider>
      );
      return root.div.querySelector('button');
    }
    function fireEvents(button: HTMLButtonElement) {
      for (const name of ['mousedown', 'mousemove', 'dragstart', 'wheel']) {
        button.dispatchEvent(new MouseEvent(name, {bubbles: true}));
      }
      button.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
      button.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, key: 'a'}));
      button.dispatchEvent(new FocusEvent('focusin', {bubbles: true}));
      button.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
      for (const name of ['input', 'paste', 'touchstart', 'scroll', 'animationend', 'transitionend']) {
        button.dispatchEvent(new Event(name, {bubbles: true}));
      }
      root.div.querySelector('img').dispatchEvent(new Event('load'));
      root.div.querySelector('video').dispatchEvent(new Event('play'));
      button.click();
    }
    try {
      // Warm the handler cache before switching modes.
      const preview = await render(false);
      fireEvents(preview);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(select).not.toHaveBeenCalled();
      for (const name of eventHandlers) {
        expect(block.getValue(name), name).toBeDefined();
        block.updateValue(name, undefined);
      }

      const design = await render(true);
      expect(design.id).toBe('selection-test');
      expect(block.getValue('ref')).toBe(design);
      fireEvents(design);
      expect(select).not.toHaveBeenCalled();
      expect(onClick).toHaveBeenCalledTimes(2);
      for (const name of eventHandlers) {
        expect(block.getValue(name), name).toBeDefined();
        block.updateValue(name, undefined);
      }

      fireEvents(await render(false));
      expect(select).not.toHaveBeenCalled();
      expect(onClick).toHaveBeenCalledTimes(3);
      for (const name of eventHandlers) expect(block.getValue(name), name).toBeDefined();
    } finally {
      flow.destroy();
    }
  });

  it('subscribes to arbitrary runtime values without invoking function values', async () => {
    const block = new Flow();
    const capture: {current?: unknown} = {};
    try {
      await root.waitRender(<ValueProbe block={block} path="value" capture={capture} />);
      expect(capture.current).toBeUndefined();
      const callback = vi.fn();
      const child = block.createBlock('child');
      for (const value of [
        1,
        'text',
        false,
        null,
        {nested: true},
        [1, 2],
        child,
        <span key="react">React</span>,
        callback,
        undefined,
      ]) {
        block.updateValue('value', value);
        await root.waitRender();
        expect(capture.current).toBe(value);
      }
      expect(callback).not.toHaveBeenCalled();
      await root.waitRender(<></>);
      expect(block.getProperty('value')._listeners.size).toBe(0);
    } finally {
      block.destroy();
    }
  });

  it('follows path creation and replacement and releases subscriptions when switching sources', async () => {
    const first = new Flow();
    const second = new Flow();
    const capture: {current?: unknown} = {};
    try {
      await root.waitRender(
        <React.StrictMode>
          <ValueProbe block={first} path="parent.value" capture={capture} />
        </React.StrictMode>
      );
      expect(capture.current).toBeUndefined();
      first.createBlock('parent').setValue('value', 1);
      await root.waitRender();
      expect(capture.current).toBe(1);
      first.deleteValue('parent');
      await root.waitRender();
      expect(capture.current).toBeUndefined();
      first.setValue('parent', {value: 2});
      await root.waitRender();
      expect(capture.current).toBe(2);

      first.setValue('other', 'first');
      second.setValue('other', 'second');
      await root.waitRender(<ValueProbe block={first} path="other" capture={capture} />);
      expect(capture.current).toBe('first');
      expect(first._bindings.size).toBe(0);
      await root.waitRender(<ValueProbe block={second} path="other" capture={capture} />);
      expect(capture.current).toBe('second');
      expect(first.getProperty('other')._listeners.size).toBe(0);
      first.setValue('other', 'old source');
      await root.waitRender();
      expect(capture.current).toBe('second');
      await root.waitRender(<></>);
      expect(second.getProperty('other')._listeners.size).toBe(0);
    } finally {
      first.destroy();
      second.destroy();
    }
  });

  it('uses a provided Flow as the context value', async function () {
    const flow = new Flow();
    const capture: {current?: Flow} = {};

    await root.waitRender(
      <FlowRoot flow={flow}>
        <FlowName capture={capture} />
      </FlowRoot>
    );

    expect(capture.current).toBe(flow);
  });

  it('releases its named temporary Flow when switching to a provided Flow', async function () {
    const capture: {current?: Flow} = {};

    await root.waitRender(
      <FlowRoot flow={{value: 1}}>
        <FlowName capture={capture} />
      </FlowRoot>
    );

    const name = capture.current.getName();
    expect(name).toMatch(/^temp-flow-/);
    expect(Root.instance.getValue(name)).toBe(capture.current);

    const providedFlow = new Flow();
    await root.waitRender(
      <FlowRoot flow={providedFlow}>
        <FlowName capture={capture} />
      </FlowRoot>
    );
    await Promise.resolve();
    expect(capture.current).toBe(providedFlow);
    expect(Root.instance.getValue(name)).toBeUndefined();

    await root.waitRender(<></>);
    await Promise.resolve();
    expect(providedFlow.isDestroyed()).toBe(false);
    providedFlow.destroy();
  });

  it('keeps its temporary Flow during StrictMode effect replay', async function () {
    const capture: {current?: Flow} = {};

    await root.waitRender(
      <React.StrictMode>
        <FlowRoot flow={{value: 1}}>
          <FlowName capture={capture} />
        </FlowRoot>
      </React.StrictMode>
    );

    const flow = capture.current;
    const name = flow.getName();
    await Promise.resolve();
    expect(Root.instance.getValue(name)).toBe(flow);

    await root.waitRender(<></>);
    await Promise.resolve();
    expect(Root.instance.getValue(name)).toBeUndefined();
  });

  it('updates filtered children on structural changes and ignores unrelated values', async function () {
    const flow = new Flow();
    const firstParent = flow.createBlock('first-parent');
    const secondParent = flow.createBlock('second-parent');
    firstParent.createBlock('first');
    secondParent.createBlock('second');
    const onRender = vi.fn();

    await root.waitRender(<FilteredBlockNames block={firstParent} onRender={onRender} />);
    expect(root.div.textContent).toBe('first');
    const initial = onRender.mock.calls.length;
    firstParent.setValue('unrelated', 42);
    await root.waitRender();
    expect(onRender).toHaveBeenCalledTimes(initial);
    firstParent.deleteValue('first');
    await root.waitRender();
    expect(root.div.textContent).toBe('');

    await root.waitRender(<FilteredBlockNames block={secondParent} onRender={onRender} />);
    expect(root.div.textContent).toBe('second');
  });
});
