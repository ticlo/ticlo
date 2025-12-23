import * as React from 'react';
import {Checkbox, ConfigProvider, Switch, Radio} from 'antd';
import {Block, DataMap, decode, encodeSorted, FunctionDesc, Flow, PropDesc, Root, addConsoleLogger} from '@ticlo/core';
import {TicloI18nSettings} from '@ticlo/core';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.js';
import {data} from './sample-data/data.js';
import reactData from './sample-data/react.js';
import {initEditor, PropertyList, BlockStage, NodeTree} from '@ticlo/editor';
import {DragDropDiv, DragState, DockLayout, DockContextType} from 'rc-dock';
import {ClientConnection} from '@ticlo/core/connect/ClientConnection.js';
import {Functions} from '@ticlo/core';
import {FunctionTree} from '@ticlo/editor/function-selector/FunctionTree.js';

import './sample-blocks.js';
import {Logger} from '@ticlo/core/util/Logger.js';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.js';
import {BlockStagePane} from '@ticlo/editor/dock/block/BlockStagePane.js';
import {TicloLayoutContext, TicloLayoutContextType} from '@ticlo/editor/component/LayoutContext.js';
import {PropDispatcher} from '@ticlo/core/block/Dispatcher.js';
import {PropertyListPane} from '@ticlo/editor/dock/property/PropertyListPane.js';
import {WsBrowserConnection} from '@ticlo/html/connect/WsBrowserConnection.js';
import {FrameClientConnection} from '@ticlo/html/connect/FrameClientConnection.js';
import {NodeTreePane} from '@ticlo/editor/dock/node-tree/NodeTreePane.js';
import {TextEditorPane} from '@ticlo/editor/dock/text-editor/TextEditorPane.js';

import '@ticlo/test';
import {theme} from '@ticlo/editor/style/theme.js';
import {FunctionSelect} from '@ticlo/editor/function-selector/FunctionSelector.js';

import i18next from 'i18next';

import zhLocal from '../i18n/editor/zh.json' with { type: 'json' };
import zhMathLocal from '../i18n/core/zh.json' with { type: 'json' };
import zhTestLocal from '../i18n/test/zh.json' with { type: 'json' };

import enLocal from '../i18n/editor/en.json' with { type: 'json' };
import enMathLocal from '../i18n/core/en.json' with { type: 'json' };
import enTestLocal from '../i18n/test/en.json' with { type: 'json' };

import frLocal from '../i18n/editor/fr.json' with { type: 'json' };
import frMathLocal from '../i18n/core/fr.json' with { type: 'json' };
import frTestLocal from '../i18n/test/fr.json' with { type: 'json' };

import {LocalizedLabel, t} from '@ticlo/editor/component/LocalizedLabel.js';
import {FlowTestCase} from '@ticlo/test/FlowTestCase.js';
import {createRoot} from 'react-dom/client';
import {SchedulePane} from '@ticlo/editor/dock/schedule/SchedulePane.js';
import {MixedBrowserConnection} from '@ticlo/html/connect/MixedBrowserConnection.js';
import {RadioChangeEvent} from 'antd';

const layoutGroups = {
  blockStage: {
    animated: false,
    floatable: true,
  },
};

import zhAntd from 'antd/es/locale/zh_CN.js';
import enAntd from 'antd/es/locale/en_US.js';
import frAntd from 'antd/es/locale/fr_FR.js';
import type {Locale} from 'antd/es/locale/index.js';

const languages = ['en', 'fr', 'zh'];
const antdLanMap: Record<string, Locale> = {
  en: enAntd as unknown as Locale,
  fr: frAntd as unknown as Locale,
  zh: zhAntd as unknown as Locale,
};

interface Props {
  conn: ClientConnection;
}

interface State {
  modal?: React.ReactElement;
}

WorkerFunctionGen.registerType({'#is': ''}, {name: 'class1'}, 'WorkerEditor');

class App extends React.PureComponent<Props, State> {
  state: State = {};
  defaultDockLayout: any;
  constructor(props: Props) {
    super(props);
    let {conn} = props;
    this.defaultDockLayout = {
      dockbox: {
        mode: 'horizontal',
        children: [
          {
            mode: 'vertical',
            size: 200,
            children: [
              {
                tabs: [
                  {
                    id: 'Navigation',
                    title: t('Navigation'),
                    cached: true,
                    content: (
                      <NodeTreePane
                        conn={conn}
                        basePaths={['']}
                        hideRoot={true}
                        onSelect={this.onSelect}
                        showMenu={true}
                      />
                    ),
                  },
                  {
                    id: 'Test Language',
                    title: 'Test Language',
                    content: (
                      <div style={{margin: 12}}>
                        <Radio.Group
                          options={languages}
                          onChange={this.switchLan}
                          defaultValue={this.lng}
                          optionType="button"
                          buttonStyle="solid"
                          size="small"
                        />
                        <br />
                        <Checkbox
                          defaultChecked={TicloI18nSettings.shouldTranslateFunction}
                          onChange={(e) => {
                            TicloI18nSettings.shouldTranslateFunction = e.target.checked;
                            this.switchLan();
                          }}
                        >
                          translate function
                        </Checkbox>
                        <br />
                        <Checkbox
                          defaultChecked={TicloI18nSettings.useLocalizedBlockName}
                          onChange={(e) => {
                            TicloI18nSettings.useLocalizedBlockName = e.target.checked;
                          }}
                        >
                          localize block name
                        </Checkbox>
                      </div>
                    ),
                  },
                ],
              },
              {
                tabs: [
                  {
                    id: 'Functions',
                    title: t('Functions'),
                    cached: true,
                    content: <FunctionSelect conn={conn} />,
                  },
                  {
                    id: 'Properties',
                    title: t('Properties'),
                    cached: true,
                    content: <PropertyListPane conn={conn} />,
                  },
                ],
              },
            ],
          },
          {
            size: 800,
            tabs: [
              /*this.createBlockEditorTab('test')*/
            ],
            id: 'main',
            panelLock: {panelStyle: 'main'},
          },
        ],
      },
    };
  }

  lng: string = 'en';
  lngConfig = antdLanMap['en'];
  switchLan = (e?: RadioChangeEvent) => {
    this.lng = e?.target.value || this.lng;
    this.lngConfig = antdLanMap[this.lng];
    // force a reload of the context
    this.ticloContext = {...this.ticloContext, language: this.lng};
    i18next.changeLanguage(this.lng, this.forceUpdateImmediate);
  };

  forceUpdateLambda = () => this.forceUpdate();
  forceUpdateImmediate = () => {
    this.props.conn.callImmediate(this.forceUpdateLambda);
  };

  layout: DockLayout;
  getLayout = (layout: DockLayout) => {
    this.layout = layout;
  };

  /// implements TicloLayoutContext
  ticloContext: TicloLayoutContext = {
    language: this.lng,
    editFlow: (path: string, onSave: () => void) => {
      this.layout.dockMove(this.createBlockEditorTab(path, onSave), this.layout.find('main'), 'middle');
    },

    editProperty: (paths: string[], propDesc: PropDesc, defaultValue?: any, mime?: string, readonly?: boolean) => {
      let {conn} = this.props;
      if (!mime) {
        if (propDesc.mime) {
          mime = propDesc.mime;
        } else if (propDesc.type === 'object' || propDesc.type === 'array') {
          mime = 'application/json';
        }
      }
      TextEditorPane.openFloatPanel(this.layout, conn, paths, defaultValue, mime, readonly);
    },
    editSchedule: (path: string, scheduleName?: string, index?: number) => {
      let {conn} = this.props;
      SchedulePane.openFloatPanel(this.layout, conn, path, scheduleName, index);
    },
    getSelectedPaths: () => this.selectedPaths,
    showModal: (modal: React.ReactElement) => this.setState({modal}),
  };

  selectedPaths: PropDispatcher<string[]> = new PropDispatcher();

  onSelect = (paths: string[], handled: boolean = false) => {
    if (!handled) {
      this.selectedPaths.updateValue(paths);
    }
  };

  createBlockEditorTab(path: string, onSave?: () => void) {
    let {conn} = this.props;
    return BlockStagePane.createDockTab(path, conn, this.onSelect, onSave);
  }

  render() {
    let {conn} = this.props;
    let {modal} = this.state;
    return (
      <ConfigProvider locale={this.lngConfig} theme={theme}>
        <TicloLayoutContextType.Provider value={this.ticloContext}>
          <DockLayout
            defaultLayout={this.defaultDockLayout}
            ref={this.getLayout}
            groups={layoutGroups}
            style={{position: 'absolute', left: 10, top: 10, right: 10, bottom: 10}}
          />
          {modal}
        </TicloLayoutContextType.Provider>
      </ConfigProvider>
    );
  }
}

(async () => {
  await initEditor();
  await i18next.init({lng: 'en'});
  i18next.addResourceBundle('zh', 'ticlo-editor', zhLocal);
  i18next.addResourceBundle('en', 'ticlo-editor', enLocal);
  i18next.addResourceBundle('fr', 'ticlo-editor', frLocal);
  i18next.addResourceBundle('zh', 'ticlo-core', zhMathLocal);
  i18next.addResourceBundle('en', 'ticlo-core', enMathLocal);
  i18next.addResourceBundle('fr', 'ticlo-core', frMathLocal);
  i18next.addResourceBundle('zh', 'ticlo-test', zhTestLocal);
  i18next.addResourceBundle('en', 'ticlo-test', enTestLocal);
  i18next.addResourceBundle('fr', 'ticlo-test', frTestLocal);

  let client = window.opener
    ? new FrameClientConnection(window.opener) // used by server-window.html
    : new MixedBrowserConnection(`http://127.0.0.1:8010/ticlo`); // used by ticlo-server
  createRoot(document.getElementById('app')).render(<App conn={client} />);
})();

(window as any).Logger = Logger;
// addConsoleLogger(Logger.TRACE_AND_ABOVE);
