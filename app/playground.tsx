import * as React from 'react';
import {Checkbox, ConfigProvider, Switch} from 'antd';
import {
  Block,
  DataMap,
  decode,
  encodeSorted,
  FunctionDesc,
  Functions,
  Logger,
  addConsoleLogger,
  PropDispatcher,
  Flow,
  PropDesc,
  Root,
  FlowStorage,
  BlockProperty,
} from '@ticlo/core';
import {BlockStagePane} from '@ticlo/editor/dock/block/BlockStagePane';
import {TicloI18nSettings} from '@ticlo/core';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection';
import {data} from './sample-data/data';
import reactData from './sample-data/react';
import {initEditor, PropertyList, BlockStage, NodeTree, ButtonRadioGroup} from '@ticlo/editor';
import {DragDropDiv, DragState, DockLayout, DockContextType} from 'rc-dock';
import {ClientConnection} from '@ticlo/core/connect/ClientConnection';

import './sample-blocks';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen';

import {TicloLayoutContext, TicloLayoutContextType} from '@ticlo/editor/component/LayoutContext';
import {PropertyListPane} from '@ticlo/editor/dock/property/PropertyListPane';
import {NodeTreePane} from '@ticlo/editor/dock/node-tree/NodeTreePane';
import {TextEditorPane} from '@ticlo/editor/dock/text-editor/TextEditorPane';
import '../packages/html';
import '../packages/react';
import '../packages/test';
import {FunctionSelect} from '@ticlo/editor/function-selector/FunctionSelector';

import i18next from 'i18next';
// @ts-ignore
import zhLocal from '../i18n/editor/zh.json';

// @ts-ignore
import zhMathLocal from '../i18n/core/zh.json';
// @ts-ignore
import zhReactLocal from '../i18n/react/zh.json';
// @ts-ignore
import zhTestLocal from '../i18n/test/zh.json';

// @ts-ignore
import enLocal from '../i18n/editor/en.json';
// @ts-ignore
import enMathLocal from '../i18n/core/en.json';
// @ts-ignore
import enReactLocal from '../i18n/react/en.json';
// @ts-ignore
import enTestLocal from '../i18n/test/en.json';

// @ts-ignore
import frLocal from '../i18n/editor/fr.json';
// @ts-ignore
import frMathLocal from '../i18n/core/fr.json';
// @ts-ignore
import frReactLocal from '../i18n/react/fr.json';
// @ts-ignore
import frTestLocal from '../i18n/test/fr.json';

import zhAntd from 'antd/lib/locale/zh_CN';
import enAntd from 'antd/lib/locale/en_US';
import frAntd from 'antd/lib/locale/fr_FR';
import type {Locale} from 'antd/lib/locale-provider';
import {LocalizedLabel, t} from '@ticlo/editor/component/LocalizedLabel';
import {IndexDbFlowStorage} from '@ticlo/html/storage/IndexDbStorage';
import {createRoot} from 'react-dom/client';
import {SchedulePane} from '@ticlo/editor/dock/schedule/SchedulePane';

const layoutGroups = {
  blockStage: {
    animated: false,
    floatable: true,
  },
  tool: {
    floatable: true,
    maximizable: true,
    newWindow: true,
  },
};

const languages = ['en', 'fr', 'zh'] as const;
const languageOptions = languages.map((lan) => ({
  value: lan,
  children: lan,
  small: true,
}));
const antdLanMap: Record<string, Locale> = {
  en: enAntd,
  fr: frAntd,
  zh: zhAntd,
};

interface Props {
  conn: ClientConnection;
}

interface State {
  modal?: React.ReactElement;
}

WorkerFunctionGen.registerType(
  {
    '#is': '',
    '#shared': {
      '#is': '',
      'add': {
        '0': 1,
        '1': 2,
        '#is': 'add',
        '@b-p': ['0', '1', '#output'],
        '@b-xyw': [11, 212, 150],
      },
    },
    '#inputs': {
      '#is': '',
      '@b-xyw': [100, 100, 150],
      '#custom': [
        {
          name: 'num',
          type: 'number',
        },
      ],
    },
    '#outputs': {
      '#is': '',
      '@b-xyw': [388, 93, 150],
      '#custom': [
        {
          name: 'ooo',
          type: 'number',
        },
      ],
      '@b-p': ['ooo'],
      '~ooo': '##.multiply.#output',
    },
    'multiply': {
      '0': 1,
      '#is': 'multiply',
      '@b-p': ['0', '1', '#output'],
      '@b-xyw': [269, 239, 150],
      '~1': '##.#shared.add.#output',
    },
  },
  {
    name: 'class1',
    properties: [
      {name: 'num', type: 'number'},
      {name: 'ooo', type: 'number'},
    ],
  },
  ''
);

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
                    group: 'tool',
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
                    group: 'tool',
                    id: 'Test UI',
                    title: 'Test UI',
                    cached: true,
                    content: <div id="main" />,
                  },
                  {
                    group: 'tool',
                    id: 'Test Language',
                    title: 'Test Language',
                    content: (
                      <div style={{margin: 12}}>
                        <ButtonRadioGroup options={languageOptions} defaultValue={this.lng} onChange={this.switchLan} />
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
                    group: 'tool',
                    id: 'Functions',
                    title: t('Functions'),
                    cached: true,
                    content: <FunctionSelect conn={conn} />,
                  },
                  {
                    group: 'tool',
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
              this.createBlockEditorTab('example', () => {
                conn.applyFlowChange('example');
              }),
            ],
            id: 'main',
            panelLock: {panelStyle: 'main'},
          },
        ],
      },
    };
  }

  lng: string = 'en';
  lngConfig = zhAntd;
  switchLan = (value?: string | number | null) => {
    if (typeof value === 'string') {
      this.lng = value;
    }
    this.lngConfig = antdLanMap[this.lng];
    // force a reload of the context
    this.ticloContext = {...this.ticloContext, language: this.lng};
    i18next.changeLanguage(this.lng, this.forceUpdateImmediate);
    console.log('switched language to ', this.lng);
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
      <ConfigProvider locale={this.lngConfig}>
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
  addConsoleLogger();
  await initEditor();

  await i18next.init({lng: 'en'});
  i18next.addResourceBundle('zh', 'ticlo-editor', zhLocal);
  i18next.addResourceBundle('en', 'ticlo-editor', enLocal);
  i18next.addResourceBundle('fr', 'ticlo-editor', frLocal);

  i18next.addResourceBundle('zh', 'ticlo-core', zhMathLocal);
  i18next.addResourceBundle('en', 'ticlo-core', enMathLocal);
  i18next.addResourceBundle('fr', 'ticlo-core', frMathLocal);

  i18next.addResourceBundle('zh', 'ticlo-react', zhReactLocal);
  i18next.addResourceBundle('en', 'ticlo-react', enReactLocal);
  i18next.addResourceBundle('fr', 'ticlo-react', frReactLocal);

  i18next.addResourceBundle('zh', 'ticlo-test', zhTestLocal);
  i18next.addResourceBundle('en', 'ticlo-test', enTestLocal);
  i18next.addResourceBundle('fr', 'ticlo-test', frTestLocal);

  await Root.instance.setStorage(new IndexDbFlowStorage());

  if (!(Root.instance.getValue('example') instanceof Flow)) {
    console.log('initialize the database');
    Root.instance.addFlow('example', reactData);
    Root.instance.addFlow('example0', data);
  }

  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd')?.setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub')?.setValue('#is', 'subtract');

  let [server, client] = makeLocalConnection(Root.instance);
  createRoot(document.getElementById('app')).render(<App conn={client} />);
})();

(window as any).Logger = Logger;
