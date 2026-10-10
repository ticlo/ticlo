import {useContext} from 'react';
import {ConfigProvider, theme} from 'antd';

export function useThemeScope() {
  const config = useContext(ConfigProvider.ConfigContext);
  // Register global variables even when the popup contains only Ticlo components.
  theme.useToken();
  return config.theme?.cssVar?.key ?? 'css-var-root';
}
