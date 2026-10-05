import React from 'react';
import {vi} from 'vitest';
import {Flow, Root} from '@ticlo/core';
import type {Block} from '@ticlo/core';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.ts';
import {FlowRoot, useFlow} from '../useFlow.tsx';
import {useFilteredBlocks} from '../useFilteredBlocks.tsx';
import {useMemoUpdate, useRefState} from '../../util/react-tools.ts';
import {ComponentContext, useSelection, useValue} from '../../index.ts';
import {useTicloComp} from '../useTicloComp.ts';

function ValueProbe({block, path, capture}: {block: Block; path: string; capture: {current?: unknown}}) {
  capture.current = useValue(block, path);
  return <span>{typeof capture.current}</span>;
}

function FlowName({capture}: {capture: {current?: Flow}}) {
  const flow = useFlow();
  capture.current = flow;
  return <span>{flow.getName()}</span>;
}

function FilteredBlockNames({block}: {block: Block}) {
  return <span>{Object.keys(useFilteredBlocks(block)).join(',')}</span>;
}

function MemoProbe({
  dependency,
  init,
  calculate,
}: {
  dependency: number;
  init: () => string;
  calculate: (state: string, dependency: number) => string;
}) {
  const [state] = useRefState(init);
  const [memo, update] = useMemoUpdate(() => calculate(state, dependency), [state, dependency, calculate]);
  return <button onClick={update}>{memo}</button>;
}

describe('react hooks', function () {
  let root: ReactRoot;

  beforeEach(function () {
    root = creatReactRoot();
  });

  afterEach(function () {
    root.remove();
  });

  it('selects on mousedown only in design mode and returns the selection command result', async () => {
    const flow = new Flow();
    const block = flow.createBlock('component');
    const select = vi.fn(() => true);
    const addSelection = vi.fn(() => false);
    const parentMouseDown = vi.fn();
    let result: boolean | undefined;
    function Probe() {
      const context = React.useContext(ComponentContext);
      const onMouseDown = useSelection(block, context);
      return (
        <div onMouseDown={parentMouseDown}>
          <span onMouseDown={onMouseDown && ((event) => (result = onMouseDown(event)))}>component</span>
        </div>
      );
    }
    try {
      await root.waitRender(
        <ComponentContext.Provider value={{designMode: true, select, addSelection}}>
          <Probe />
        </ComponentContext.Provider>
      );
      const span = root.div.querySelector('span');
      span.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
      expect(select).toHaveBeenCalledWith([block]);
      expect(addSelection).not.toHaveBeenCalled();
      expect(result).toBe(true);
      span.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, ctrlKey: true}));
      expect(addSelection).toHaveBeenCalledWith([block]);
      expect(result).toBe(false);
      expect(parentMouseDown).not.toHaveBeenCalled();

      await root.waitRender(
        <ComponentContext.Provider value={{designMode: false, select, addSelection}}>
          <Probe />
        </ComponentContext.Provider>
      );
      root.div.querySelector('span').dispatchEvent(new MouseEvent('mousedown', {bubbles: true, ctrlKey: true}));
      expect(select).toHaveBeenCalledTimes(1);
      expect(addSelection).toHaveBeenCalledTimes(1);
      expect(parentMouseDown).toHaveBeenCalledTimes(1);
    } finally {
      flow.destroy();
    }
  });

  it('skips all optional event handlers in design mode and restores them in preview', async () => {
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
      expect(select).toHaveBeenCalledWith([block]);
      expect(onClick).toHaveBeenCalledTimes(1);
      for (const name of eventHandlers) expect(block.getValue(name), name).toBeUndefined();

      fireEvents(await render(false));
      expect(select).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledTimes(2);
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
        <span>React</span>,
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

  it('rebuilds filtered children when the source block changes', async function () {
    const flow = new Flow();
    const firstParent = flow.createBlock('first-parent');
    const secondParent = flow.createBlock('second-parent');
    firstParent.createBlock('first');
    secondParent.createBlock('second');

    await root.waitRender(<FilteredBlockNames block={firstParent} />);
    expect(root.div.textContent).toBe('first');

    await root.waitRender(<FilteredBlockNames block={secondParent} />);
    expect(root.div.textContent).toBe('second');
  });

  it('memoizes fresh dependencies and recalculates on explicit updates or dependency changes', async function () {
    const init = vi.fn(() => 'value');
    const calculate = vi.fn((state: string, dependency: number) => `${state}:${dependency}`);

    await root.waitRender(<MemoProbe dependency={1} init={init} calculate={calculate} />);
    await root.waitRender(<MemoProbe dependency={1} init={init} calculate={calculate} />);
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(root.div.textContent).toBe('value:1');

    root.div.querySelector('button').click();
    await root.waitRender();
    expect(calculate).toHaveBeenCalledTimes(2);

    await root.waitRender(<MemoProbe dependency={2} init={init} calculate={calculate} />);
    expect(calculate).toHaveBeenCalledTimes(3);
    expect(root.div.textContent).toBe('value:2');
    expect(init).toHaveBeenCalledTimes(1);
  });
});
