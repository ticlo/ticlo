import React, {StrictMode, useEffect, useRef} from 'react';
import {vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {Switch} from 'antd';
import '../style/index.scss';
import {Block, Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {DesignerApp} from '../DesignerApp.tsx';
import {loadTemplate, removeLastTemplate} from '@ticlo/editor/util/test-util.ts';
import {DesignerStage} from '../DesignerStage.tsx';
import {useActiveDesignerStage, type DesignerStageContextValue} from '../DesignerContext.tsx';

describe('Designer input', () => {
  const path = 'DesignerInputTest';
  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue(path);
  });

  async function createPage() {
    const flow = Root.instance.addFlow(path, {
      '#main': {
        '#is': 'react:div',
        '#order': ['a', 'b'],
        'a': {'#is': 'react:div', '#optional': ['onMouseDown', 'onClick']},
        'b': {'#is': 'react:button', 'content': 'Second'},
      },
    });
    const main = flow.getValue('#main') as Block;
    const a = main.getValue('a') as Block;
    const b = main.getValue('b') as Block;
    const reactHandler = vi.fn();
    const nativeHandler = vi.fn();
    const switchChange = vi.fn();
    const outsideClick = vi.fn();
    const eventTypes = [
      'pointerdown',
      'mousedown',
      'mouseover',
      'click',
      'keydown',
      'touchstart',
      'focus',
      'input',
      'paste',
      'wheel',
      'dragstart',
      'dragenter',
      'dragover',
      'drop',
    ];
    function InnerComponent() {
      const ref = useRef<HTMLDivElement>(null);
      useEffect(() => {
        const element = ref.current;
        for (const type of eventTypes) element.addEventListener(type, nativeHandler, true);
        return () => {
          for (const type of eventTypes) element.removeEventListener(type, nativeHandler, true);
        };
      }, []);
      return (
        <div
          ref={ref}
          onPointerDownCapture={reactHandler}
          onMouseDownCapture={reactHandler}
          onMouseOverCapture={reactHandler}
          onClickCapture={reactHandler}
          onClick={reactHandler}
          onKeyDownCapture={reactHandler}
          onTouchStartCapture={reactHandler}
          onFocusCapture={reactHandler}
          onInputCapture={reactHandler}
          onPasteCapture={reactHandler}
          onWheelCapture={reactHandler}
          onDragStartCapture={reactHandler}
          onDragOverCapture={reactHandler}
          onDropCapture={reactHandler}
        >
          <span draggable style={{userSelect: 'text'}}>
            Inner label
          </span>
          <input defaultValue="editable" onChange={reactHandler} />
          <Switch onChange={switchChange} />
          <iframe title="Embedded page" srcDoc="<button>Embedded button</button>" />
        </div>
      );
    }
    a.updateValue('content', <InnerComponent />);
    let stage: DesignerStageContextValue;
    function Panel(): null {
      stage = useActiveDesignerStage();
      return null;
    }
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    const [, div] = loadTemplate(
      <StrictMode>
        <DesignerApp value={{}}>
          <div style={{width: 600, height: 400}}>
            <DesignerStage root={Root.instance} conn={conn} basePath={path} />
          </div>
          <button onClick={outsideClick}>Outside panel</button>
          <Panel />
        </DesignerApp>
      </StrictMode>
    );
    await shouldHappen(() => stage?.main === main && div.querySelector('input'));
    const host = div.querySelector<HTMLElement>('.ticl-d-stage');
    const label = host.querySelector('span');
    const input = host.querySelector('input');
    const toggle = host.querySelector<HTMLButtonElement>('.ant-switch');
    const second = host.querySelector<HTMLButtonElement>('.ticl-d-page > div > button');
    return {
      a,
      b,
      div,
      host,
      label,
      input,
      toggle,
      second,
      reactHandler,
      nativeHandler,
      switchChange,
      outsideClick,
      getStage: () => stage,
    };
  }

  it('intercepts React capture and native input while keeping selection, hover, and outside panels working', async () => {
    const {
      a,
      b,
      div,
      host,
      label,
      input,
      toggle,
      second,
      reactHandler,
      nativeHandler,
      switchChange,
      outsideClick,
      getStage,
    } = await createPage();
    await userEvent.click(label);
    await shouldHappen(() => getStage().selection.blocks[0] === a);
    expect(document.activeElement).toBe(host);
    expect(getComputedStyle(label).userSelect).toBe('none');
    expect(input.disabled).toBe(false);
    expect(toggle.disabled).toBe(false);
    expect(getComputedStyle(host.querySelector('iframe')).pointerEvents).toBe('none');
    expect(getStage().elementMap.getBlock(label.parentElement.parentElement)).toBe(a);
    await shouldHappen(() => host.querySelector('.ticl-d-selection-rect'));
    label.dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
    second.dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
    await shouldHappen(() => host.querySelector('.ticl-d-hover-rect'));
    second.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, ctrlKey: true}));
    await shouldHappen(() => getStage().selection.blocks.length === 2);
    expect(getStage().selection.blocks).toEqual([a, b]);

    await userEvent.click(input);
    await userEvent.keyboard('design');
    expect(document.activeElement).toBe(host);
    expect(input.value).toBe('editable');
    await userEvent.dragAndDrop(label, second);

    for (const type of ['touchstart', 'dblclick', 'contextmenu', 'dragenter', 'dragover', 'dragleave', 'drop']) {
      const event = new Event(type, {bubbles: true, cancelable: true});
      input.dispatchEvent(event);
      expect(event.defaultPrevented, type).toBe(true);
    }
    const wheel = new WheelEvent('wheel', {bubbles: true, cancelable: true});
    input.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    input.focus();
    expect(document.activeElement).toBe(host);
    const tab = new KeyboardEvent('keydown', {key: 'Tab', bubbles: true, cancelable: true});
    host.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    await userEvent.click(toggle);
    expect(toggle.classList.contains('ant-switch-checked')).toBe(false);
    expect(switchChange).not.toHaveBeenCalled();
    expect(reactHandler).not.toHaveBeenCalled();
    expect(nativeHandler).not.toHaveBeenCalled();
    expect(a.getValue('onMouseDown')).toBeUndefined();
    expect(a.getValue('onClick')).toBeUndefined();

    await userEvent.click(div.querySelector<HTMLButtonElement>('.ticl-e-app > button'));
    expect(outsideClick).toHaveBeenCalledOnce();
  });

  it('restores input and original styles in preview, redirects focus when returning to design, and removes listeners', async () => {
    const {a, host, label, input, toggle, reactHandler, nativeHandler, switchChange, getStage} = await createPage();
    getStage().select([a]);
    getStage().setDesignMode(false);
    await shouldHappen(() => !host.classList.contains('ticl-d-stage-design'));
    expect(getComputedStyle(label).userSelect).toBe('text');
    expect(getComputedStyle(host.querySelector('iframe')).pointerEvents).toBe('auto');
    await userEvent.click(toggle);
    expect(toggle.classList.contains('ant-switch-checked')).toBe(true);
    expect(switchChange).toHaveBeenCalledOnce();
    expect(reactHandler).toHaveBeenCalled();
    expect(nativeHandler).toHaveBeenCalled();
    expect(a.getValue('onClick')).toBeDefined();
    await userEvent.fill(input, 'preview');
    expect(input.value).toBe('preview');
    expect(document.activeElement).toBe(input);
    getStage().setDesignMode(true);
    await shouldHappen(() => host.classList.contains('ticl-d-stage-design'));
    expect(document.activeElement).toBe(host);
    expect(getStage().selection.blocks).toEqual([a]);
    reactHandler.mockClear();
    nativeHandler.mockClear();
    await userEvent.click(toggle);
    expect(switchChange).toHaveBeenCalledOnce();
    expect(reactHandler).not.toHaveBeenCalled();
    expect(nativeHandler).not.toHaveBeenCalled();

    removeLastTemplate();
    const event = new MouseEvent('mousedown', {bubbles: true, cancelable: true});
    host.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
