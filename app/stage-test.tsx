import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Button, ConfigProvider, message} from 'antd';
import i18next from 'i18next';
import {Root, addConsoleLogger} from '@ticlo/core';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {initEditor} from '@ticlo/editor';
import {TicloApp} from '@ticlo/editor/component/TicloApp.tsx';
import {BlockStagePane} from '@ticlo/editor/dock/block/BlockStagePane.tsx';
import {theme} from '@ticlo/editor/style/theme.ts';
import '@ticlo/html';
import {data} from './sample-data/data.ts';
import enEditor from '../i18n/editor/en.json' with {type: 'json'};
import enCore from '../i18n/core/en.json' with {type: 'json'};

function FullscreenButton() {
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const label = fullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
  return (
    <Button
      className="stage-test-fullscreen"
      size="small"
      shape="circle"
      icon={
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          <path d={fullscreen ? 'M2 6h4V2m4 0v4h4M6 14v-4H2m12 0h-4v4' : 'M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4'} />
        </svg>
      }
      aria-label={label}
      title={label}
      disabled={!document.fullscreenEnabled}
      onClick={() => {
        const change = document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen();
        void change.catch((error: Error) => message.error(error.message));
      }}
    />
  );
}

(async () => {
  addConsoleLogger();
  await initEditor();
  i18next.addResourceBundle('en', 'ticlo-editor', enEditor);
  i18next.addResourceBundle('en', 'ticlo-core', enCore);
  await i18next.changeLanguage('en');

  Root.instance.addFlow('example', data);
  const [, client] = makeLocalConnection(Root.instance);
  createRoot(document.getElementById('app')).render(
    <ConfigProvider theme={theme}>
      <TicloApp value={{language: 'en'}}>
        <BlockStagePane conn={client} basePath="example" disablePropertyList />
      </TicloApp>
      <FullscreenButton />
    </ConfigProvider>
  );
})();
