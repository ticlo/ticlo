import React from 'react';
import {flushSync} from 'react-dom';
import {createRoot, type Root} from 'react-dom/client';
import {App as AntdApp, ConfigProvider, type ThemeConfig} from 'antd';
import {DragDropDiv} from 'rc-dock';
import {simulate} from 'simulate-event';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {TicloApp} from '../TicloApp.tsx';
import {theme, darkTheme} from '../../style/theme.ts';
import {fakeMouseEvent, loadTemplate, removeLastTemplate} from '../../util/test-util.ts';

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  loadTemplate(null, 'editor');
  container = document.createElement('div');
  container.style.position = 'relative';
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  simulate(document.body, 'mouseup');
  flushSync(() => root.unmount());
  container.remove();
  removeLastTemplate();
});

function source() {
  return (
    <AntdApp>
      <TicloApp value={{}}>
        <DragDropDiv
          className="ticl-e-func-view"
          style={{width: 150}}
          onDragStartT={(state) => state.startDrag(undefined, undefined, {opacity: 0.9})}
        >
          <span className="ticl-e-func-name">Preview</span>
        </DragDropDiv>
      </TicloApp>
    </AntdApp>
  );
}

async function checkPreview(background: string, font?: string) {
  const element = container.querySelector<HTMLElement>('.ticl-e-func-view');
  const rect = element.getBoundingClientRect();
  simulate(element, 'mousedown', fakeMouseEvent(rect.left + 10, rect.top + 10));
  simulate(document.body, 'mousemove', fakeMouseEvent(rect.left + 40, rect.top + 30));
  const layer = await shouldHappen(() => document.querySelector<HTMLElement>('body > .dragging-layer'));
  const clone = layer.firstElementChild;
  const label = clone.querySelector('.ticl-e-func-name');
  await expect.poll(() => getComputedStyle(clone).backgroundColor).toBe(background);
  expect(getComputedStyle(label).backgroundColor).toBe(background);
  expect(getComputedStyle(layer).color).toBe(getComputedStyle(element).color);
  expect(getComputedStyle(layer).fontFamily).toBe(font ?? getComputedStyle(element).fontFamily);
  expect(layer.style.getPropertyValue('--ant-color-bg-container')).toBe('');
  expect(getComputedStyle(layer).opacity).toBe('0.9');
  simulate(document.body, 'mouseup');
  expect(document.querySelector('.dragging-layer')).toBeNull();
}

it('applies the current light or dark theme to new previews without styling body', async () => {
  const bodyClass = document.body.className;
  const bodyStyle = document.body.style.cssText;
  for (const [config, background] of [
    [theme, 'rgb(255, 255, 255)'],
    [darkTheme, 'rgb(20, 20, 20)'],
    [theme, 'rgb(255, 255, 255)'],
  ] as [ThemeConfig, string][]) {
    flushSync(() => root.render(<ConfigProvider theme={config}>{source()}</ConfigProvider>));
    await checkPreview(background);
    expect(document.body.className).toBe(bodyClass);
    expect(document.body.style.cssText).toBe(bodyStyle);
  }
});

it('uses the nearest provider with a generated scope and custom font', async () => {
  flushSync(() =>
    root.render(
      <ConfigProvider theme={darkTheme}>
        <ConfigProvider theme={{token: {colorBgContainer: '#123456', fontFamily: 'monospace'}}}>
          {source()}
        </ConfigProvider>
      </ConfigProvider>
    )
  );
  await checkPreview('rgb(18, 52, 86)', 'monospace');
});
