import React from 'react';
import {flushSync} from 'react-dom';
import {createRoot, type Root} from 'react-dom/client';
import {ConfigProvider, type ThemeConfig} from 'antd';
import {userEvent} from 'vitest/browser';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {Menu, MenuItem, Popup, SubMenuItem} from '../ClickPopup.tsx';
import {theme, darkTheme} from '../../style/theme.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';

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
  flushSync(() => root.unmount());
  container.remove();
  removeLastTemplate();
});

it('updates open menus and submenus when the theme changes without styling body', async () => {
  const onClick = vi.fn();
  const menu = (
    <Menu>
      {[
        <SubMenuItem
          key="submenu"
          popup={
            <Menu>
              {[
                <MenuItem key="item" value="selected" onClick={onClick}>
                  Select item
                </MenuItem>,
              ]}
            </Menu>
          }
        >
          Submenu
        </SubMenuItem>,
      ]}
    </Menu>
  );
  const bodyClass = document.body.className;
  const render = (config: ThemeConfig) =>
    flushSync(() =>
      root.render(
        <ConfigProvider theme={config}>
          <Popup popup={menu}>
            <button>Open menu</button>
          </Popup>
        </ConfigProvider>
      )
    );
  render(theme);
  await userEvent.click(container.querySelector('button'));
  const popup = await shouldHappen(() => document.querySelector<HTMLElement>('.ticl-e-dropdown'));
  await userEvent.click(popup.querySelector('.ticl-e-dropdown-menu-item'));
  const submenu = await shouldHappen(() => document.querySelectorAll<HTMLElement>('.ticl-e-dropdown')[1]);
  const popups = [popup, submenu];
  for (const element of popups) {
    expect(container.contains(element)).toBe(false);
    await expect.poll(() => getComputedStyle(element).backgroundColor).toBe('rgb(255, 255, 255)');
    expect(getComputedStyle(element).fontFamily).toContain('Nato Sans');
  }

  render(darkTheme);
  for (const element of popups) {
    await expect.poll(() => getComputedStyle(element).backgroundColor).toBe('rgb(31, 31, 31)');
  }
  render(theme);
  for (const element of popups) {
    await expect.poll(() => getComputedStyle(element).backgroundColor).toBe('rgb(255, 255, 255)');
  }
  expect(document.body.className).toBe(bodyClass);
  await userEvent.click(submenu.querySelector('.ticl-e-dropdown-menu-item'));
  expect(onClick).toHaveBeenCalledWith('selected');
});

it('uses the nearest provider with a generated theme scope and custom font', async () => {
  flushSync(() =>
    root.render(
      <ConfigProvider theme={darkTheme}>
        <ConfigProvider theme={{token: {colorBgElevated: '#123456', fontFamily: 'monospace'}}}>
          <Popup popup={<div>Custom theme</div>}>
            <button>Open popup</button>
          </Popup>
        </ConfigProvider>
      </ConfigProvider>
    )
  );
  await userEvent.click(container.querySelector('button'));
  const popup = await shouldHappen(() => document.querySelector<HTMLElement>('.ticl-e-dropdown'));
  await expect.poll(() => getComputedStyle(popup).backgroundColor).toBe('rgb(18, 52, 86)');
  expect(getComputedStyle(popup).fontFamily).toBe('monospace');
});
