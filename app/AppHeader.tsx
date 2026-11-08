import React, {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {Button, ConfigProvider, Dropdown, type MenuProps} from 'antd';
import type {Locale} from 'antd/es/locale/index.js';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  FileOutlined,
  MoonOutlined,
  ReloadOutlined,
  SunOutlined,
  TagsOutlined,
  TranslationOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import {TicloI18nSettings} from '@ticlo/core';
import {TicloCurrentFlowContext} from '@ticlo/editor/component/LayoutContext.ts';
import {TooltipIconButton} from '@ticlo/editor/component/TooltipIconButton.tsx';
import {t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {theme, darkTheme} from '@ticlo/editor/style/theme.ts';
import './AppHeader.scss';

export const appHeaderHeight = 40;

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

const languages = [
  {key: 'en', name: 'English'},
  {key: 'zh', name: '中文'},
];

function flag(language: string) {
  const icon = language === 'en' ? './flags/us.svg' : `./flags/language/${language}.svg`;
  return <img className="ticl-app-flag" src={new URL(icon, location.href).href} />;
}

function HeaderMenu({label, icon, items}: {label: string; icon: React.ReactNode; items?: MenuProps['items']}) {
  const button = (
    <Button size="small" icon={icon} className="ticl-app-header-menu-button" disabled={!items?.length}>
      {t(label)}
    </Button>
  );
  return items?.length ? <Dropdown menu={{items}}>{button}</Dropdown> : button;
}

export function AppHeader({
  language,
  onLanguageChange,
  fileItems,
  libraryItems,
  viewItems,
  children,
}: {
  language: string;
  onLanguageChange: (language: string) => void;
  fileItems?: MenuProps['items'];
  libraryItems?: MenuProps['items'];
  viewItems?: MenuProps['items'];
  children?: ReactNode;
}) {
  const {darkMode, setDarkMode} = useContext(ThemeContext);
  const {activeStage: stage} = useContext(TicloCurrentFlowContext);
  const [translateFunctions, setTranslateFunctions] = useState(TicloI18nSettings.shouldTranslateFunction);
  const [localizeNames, setLocalizeNames] = useState(TicloI18nSettings.useLocalizedBlockName);
  const languageItems: MenuProps['items'] = [
    ...languages.map(({key, name}) => ({
      key,
      label: (
        <span className="ticl-app-language">
          {flag(key)} {name}
        </span>
      ),
    })),
    {type: 'divider'},
    {
      key: 'translate-functions',
      icon: <TranslationOutlined />,
      label: `${translateFunctions ? '✓ ' : ''}Translate functions`,
    },
    {key: 'localize-names', icon: <TagsOutlined />, label: `${localizeNames ? '✓ ' : ''}Localize block names`},
  ];
  const languageMenu: MenuProps = {
    items: languageItems,
    selectedKeys: [language],
    onClick: ({key}) => {
      if (key === 'translate-functions') {
        TicloI18nSettings.shouldTranslateFunction = !translateFunctions;
        setTranslateFunctions(!translateFunctions);
        onLanguageChange(language);
      } else if (key === 'localize-names') {
        TicloI18nSettings.useLocalizedBlockName = !localizeNames;
        setLocalizeNames(!localizeNames);
      } else onLanguageChange(key);
    },
  };

  return (
    <header className="ticl-app-header">
      <div className="ticl-app-header-left">
        <img className="ticl-app-logo" src={new URL('./ticlo-header-icon.svg', import.meta.url).href} title="Ticlo" />
        {fileItems?.length ? <HeaderMenu label="File" icon={<FileOutlined />} items={fileItems} /> : null}
        {libraryItems?.length ? <HeaderMenu label="Library" icon={<ApartmentOutlined />} items={libraryItems} /> : null}
        <HeaderMenu label="View" icon={<AppstoreOutlined />} items={viewItems} />
      </div>
      <div className="ticl-app-header-center">
        {stage?.conn && stage.undo && stage.redo ? (
          <div key={stage.id} className="ticl-app-header-tools">
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
        ) : (
          <div className="ticl-app-header-tools">
            <Button size="small" shape="circle" icon={<UndoOutlined />} disabled />
            <Button size="small" shape="circle" icon={<ReloadOutlined />} disabled />
          </div>
        )}
        {children}
      </div>
      <div className="ticl-app-header-right">
        <Button
          size="small"
          type="text"
          icon={darkMode ? <SunOutlined /> : <MoonOutlined />}
          title={darkMode ? 'Light mode' : 'Dark mode'}
          onClick={() => setDarkMode(!darkMode)}
        />
        <Dropdown menu={languageMenu} placement="bottomRight">
          <Button size="small" type="text" title="Language" icon={flag(language)} />
        </Dropdown>
      </div>
    </header>
  );
}
