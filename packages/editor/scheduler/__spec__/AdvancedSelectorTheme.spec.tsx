import React from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ConfigProvider, type ThemeConfig} from 'antd';
import {userEvent} from 'vitest/browser';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {AdvancedSelector} from '../editors/AdvancedSelector.tsx';
import {theme, darkTheme} from '../../style/theme.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';

it('updates an open cached days dropdown when the theme changes', async () => {
  // Load the extracted CSS used by zeroRuntime, including the custom picker view.
  loadTemplate(null, 'editor');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onValueChange = vi.fn();
  const current = {years: [] as number[], months: [] as number[], days: [1]};
  const render = (config: ThemeConfig) => {
    flushSync(() =>
      root.render(
        <ConfigProvider theme={darkTheme}>
          <ConfigProvider theme={config}>
            <AdvancedSelector current={current} onValueChange={onValueChange} />
          </ConfigProvider>
        </ConfigProvider>
      )
    );
  };
  try {
    render(theme);
    await userEvent.click(container.querySelectorAll('.ant-select')[2]);
    const popup = await shouldHappen(() => document.querySelector<HTMLElement>('.ticl-e-schedule-days-dropdown'));
    const backdrop = popup.closest('.ant-select-dropdown');
    const selected = popup.querySelector('.ant-picker-cell-selected .ant-picker-cell-inner');
    await shouldHappen(() => getComputedStyle(selected).backgroundColor !== 'rgba(0, 0, 0, 0)');
    const lightBackground = getComputedStyle(backdrop).backgroundColor;
    const lightSelection = getComputedStyle(selected).backgroundColor;

    render(darkTheme);
    await expect.poll(() => getComputedStyle(backdrop).backgroundColor).not.toBe(lightBackground);
    await expect.poll(() => getComputedStyle(selected).backgroundColor).not.toBe(lightSelection);
    await userEvent.click(popup.querySelectorAll('.ant-picker-cell')[1]);
    expect(onValueChange).toHaveBeenCalledWith([1, 2], 'days');

    render(theme);
    await expect.poll(() => getComputedStyle(backdrop).backgroundColor).toBe(lightBackground);
    await expect.poll(() => getComputedStyle(selected).backgroundColor).toBe(lightSelection);
  } finally {
    flushSync(() => root.unmount());
    container.remove();
    removeLastTemplate();
  }
});
