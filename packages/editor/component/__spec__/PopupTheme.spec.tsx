import React from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ConfigProvider, Modal, theme as antdTheme} from 'antd';
import {userEvent} from 'vitest/browser';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {Popup, Menu, MenuItem, SubMenuItem} from '../ClickPopup.tsx';
import {TicloApp} from '../TicloApp.tsx';
import {PopupHost, type PopupActions} from '../../popup/PopupHost.tsx';
import {theme} from '../../style/theme.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  removeLastTemplate();
});

function createPopupRoot() {
  loadTemplate(null, 'editor');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  cleanups.push(() => {
    flushSync(() => root.unmount());
    container.remove();
  });
  return root;
}

it('keeps custom menus and submenus in the nested theme and configured popup container', async () => {
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const root = createPopupRoot();
  const render = (background: string) =>
    flushSync(() =>
      root.render(
        <ConfigProvider theme={theme}>
          <ConfigProvider
            theme={{token: {colorBgElevated: background, colorText: '#123456'}}}
            getPopupContainer={() => mount}
          >
            <Popup
              popupVisible
              popup={
                <Menu>
                  {[
                    <SubMenuItem key="submenu" popup={<Menu>{[<MenuItem key="action">Nested action</MenuItem>]}</Menu>}>
                      Open submenu
                    </SubMenuItem>,
                  ]}
                </Menu>
              }
            >
              <button>Open menu</button>
            </Popup>
          </ConfigProvider>
        </ConfigProvider>
      )
    );
  try {
    render('#fedcba');
    const menu: HTMLElement = await shouldHappen(() => mount.querySelector<HTMLElement>('.ticl-e-dropdown'));
    await expect.poll(() => getComputedStyle(menu).backgroundColor).toBe('rgb(254, 220, 186)');
    expect(getComputedStyle(menu).color).toBe('rgb(18, 52, 86)');
    await userEvent.click(menu.querySelector<HTMLElement>('.ticl-e-dropdown-menu-item'));
    const submenu = await shouldHappen(() =>
      [...mount.querySelectorAll<HTMLElement>('.ticl-e-dropdown')].find(
        (element) => element.textContent === 'Nested action'
      )
    );
    expect(getComputedStyle(submenu).backgroundColor).toBe('rgb(254, 220, 186)');
    render('#234567');
    await expect.poll(() => getComputedStyle(menu).backgroundColor).toBe('rgb(35, 69, 103)');
    await expect.poll(() => getComputedStyle(submenu).backgroundColor).toBe('rgb(35, 69, 103)');
  } finally {
    removeLastTemplate();
    mount.remove();
  }
});

it('keeps dialogs, confirmations, and feedback in their caller context across theme updates', async () => {
  const popup = React.createRef<PopupActions>();
  const customContext = React.createContext('outside');
  function Probe() {
    const {token} = antdTheme.useToken();
    return (
      <span className="popup-theme-probe">
        {React.useContext(customContext)}:{token.colorPrimary}
      </span>
    );
  }
  const root = createPopupRoot();
  const render = (color: string) =>
    flushSync(() =>
      root.render(
        <ConfigProvider theme={theme}>
          <ConfigProvider theme={{token: {colorPrimary: color, colorBgElevated: color}}}>
            <customContext.Provider value="caller">
              <PopupHost ref={popup} />
            </customContext.Provider>
          </ConfigProvider>
        </ConfigProvider>
      )
    );
  render('#123456');
  flushSync(() => {
    popup.current.showModal(
      <Modal open footer={null}>
        <Probe />
      </Modal>
    );
    popup.current.modal.confirm({content: <Probe />});
    popup.current.requestCallbacks.onError('Nested request error');
    popup.current.notification.error({title: 'Nested notification'});
  });
  await shouldHappen(() => document.querySelectorAll('.popup-theme-probe').length === 2);
  expect([...document.querySelectorAll('.popup-theme-probe')].map((element) => element.textContent)).toEqual([
    'caller:#123456',
    'caller:#123456',
  ]);
  const message = await shouldHappen(() => document.querySelector<HTMLElement>('.ant-message-notice-content'));
  const notification = await shouldHappen(() => document.querySelector<HTMLElement>('.ant-notification-notice'));
  await expect.poll(() => getComputedStyle(message).backgroundColor).toBe('rgb(18, 52, 86)');
  await expect.poll(() => getComputedStyle(notification).backgroundColor).toBe('rgb(18, 52, 86)');
  render('#654321');
  await expect
    .poll(() => [...document.querySelectorAll('.popup-theme-probe')].map((element) => element.textContent))
    .toEqual(['caller:#654321', 'caller:#654321']);
  await expect.poll(() => getComputedStyle(message).backgroundColor).toBe('rgb(101, 67, 33)');
  await expect.poll(() => getComputedStyle(notification).backgroundColor).toBe('rgb(101, 67, 33)');
});

it('isolates simultaneous themes made from the exported preset without manual scope keys', async () => {
  const [, div] = loadTemplate(
    <ConfigProvider theme={theme}>
      <TicloApp value={{}}>
        <span className="outer-theme" style={{color: 'var(--ant-color-primary)'}}>
          Outer
        </span>
        <ConfigProvider theme={{...theme, token: {...theme.token, colorPrimary: '#ff0000'}}}>
          <TicloApp value={{}}>
            <span className="inner-theme" style={{color: 'var(--ant-color-primary)'}}>
              Inner
            </span>
          </TicloApp>
        </ConfigProvider>
      </TicloApp>
    </ConfigProvider>,
    'editor'
  );
  await expect.poll(() => getComputedStyle(div.querySelector('.outer-theme')).color).toBe('rgb(64, 169, 255)');
  expect(getComputedStyle(div.querySelector('.inner-theme')).color).toBe('rgb(255, 0, 0)');
});
