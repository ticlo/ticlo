import {ThemeConfig} from 'antd';

export const theme: ThemeConfig = {
  zeroRuntime: true,
  token: {
  fontFamily:
    "'Nato Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'WenQuanYi Micro Hei', Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'",
  colorPrimary: '#40a9ff',
  colorPrimaryHover: '#69c0ff',
  colorInfo: '#1890ff',
  colorError: '#ff4d4f',
  colorLink: '#108ee9',
  colorText: 'rgba(0, 0, 0, 0.75)',
  colorTextSecondary: 'rgba(0, 0, 0, 0.5)',
  colorTextTertiary: 'rgba(0, 0, 0, 0.35)',
  colorTextHeading: 'rgba(0, 0, 0, 0.9)',
  colorTextDisabled: 'rgba(0, 0, 0, 0.6)',
  colorBorder: '#d9d9d9',
  colorBorderSecondary: '#f0f0f0',
  colorBgContainerDisabled: 'transparent',
  controlItemBgHover: '#f5f5f5',
  controlPaddingHorizontal: 12,
},
};

export const darkTheme: ThemeConfig = {
  zeroRuntime: true,
  token: {
    fontFamily:
      "'Nato Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'WenQuanYi Micro Hei', Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'",
    colorPrimary: '#40a9ff',
    colorPrimaryHover: '#69c0ff',
    colorInfo: '#1890ff',
    colorError: '#ff4d4f',
    colorLink: '#108ee9',
    colorText: 'rgba(255, 255, 255, 0.75)',
    colorTextSecondary: 'rgba(255, 255, 255, 0.5)',
    colorTextTertiary: 'rgba(255, 255, 255, 0.35)',
    colorTextHeading: 'rgba(255, 255, 255, 1)',
    colorTextDisabled: 'rgba(255, 255, 255, 0.65)',
    colorBorder: '#f0f0f0',
    colorBorderSecondary: '#f0f0f0',
    colorBgContainerDisabled: 'transparent',
    controlItemBgHover: 'rgba(255, 255, 255, 0.08)',
    controlPaddingHorizontal: 12,
  },
  algorithm: "dark"
};