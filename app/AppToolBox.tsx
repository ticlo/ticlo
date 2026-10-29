import React, {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {ConfigProvider, Switch, type RadioChangeEvent} from 'antd';
import type {Locale} from 'antd/es/locale/index.js';
import {ReloadOutlined, UndoOutlined} from '@ant-design/icons';
import {TicloCurrentFlowContext} from '@ticlo/editor/component/LayoutContext.ts';
import {TooltipIconButton} from '@ticlo/editor/component/TooltipIconButton.tsx';
import {t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {theme, darkTheme} from '@ticlo/editor/style/theme.ts';
import {LanguageSettings} from './AppI18n.tsx';

const ThemeContext = createContext<{darkMode: boolean; setDarkMode: (value: boolean) => void}>(null);

export function AppTheme({locale, children}: {locale: Locale; children: ReactNode}) {
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    document.body.style.colorScheme = darkMode ? 'dark' : 'light';
  }, [darkMode]);
  return (
    <ConfigProvider locale={locale} theme={darkMode ? darkTheme : theme}>
      <ThemeContext.Provider value={{darkMode, setDarkMode}}>{children}</ThemeContext.Provider>
    </ConfigProvider>
  );
}

export function AppToolBox({switchLan, children}: {switchLan: (e?: RadioChangeEvent) => void; children?: ReactNode}) {
  const {darkMode, setDarkMode} = useContext(ThemeContext);
  const {activeStage: stage} = useContext(TicloCurrentFlowContext);
  return (
    <div style={{position: 'relative', padding: 8, height: '100%', overflow: 'auto', boxSizing: 'border-box'}}>
      <LanguageSettings onChange={switchLan} />
      <br />
      {children}
      <label style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 8}}>
        <Switch size="small" checked={darkMode} onChange={setDarkMode} />
        Dark mode
      </label>
      {stage?.conn && stage.undo && stage.redo && (
        <div key={stage.id} style={{display: 'flex', gap: 8, marginTop: 8}}>
          <TooltipIconButton
            conn={stage.conn}
            path={`${stage.basePath}.#flow.@has-undo`}
            tooltip={t('Undo')}
            icon={<UndoOutlined />}
            onClick={stage.undo}
          />
          <TooltipIconButton
            conn={stage.conn}
            path={`${stage.basePath}.#flow.@has-redo`}
            tooltip={t('Redo')}
            icon={<ReloadOutlined />}
            onClick={stage.redo}
          />
        </div>
      )}
    </div>
  );
}
