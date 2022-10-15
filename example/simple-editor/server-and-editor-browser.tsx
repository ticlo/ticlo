import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {Checkbox, ConfigProvider, Switch} from 'antd';
import {
  Block,
  DataMap,
  decode,
  encodeSorted,
  FunctionDesc,
  Functions,
  Logger,
  PropDispatcher,
  Flow,
  PropDesc,
  Root,
  Storage,
  BlockProperty,
} from '../../src/core';
import {BlockStagePane} from '../../src/editor/dock/block/BlockStagePane';
import {TicloI18nSettings} from '../../src/core/editor';
import {makeLocalConnection} from '../../src/core/connect/LocalConnection';
import {data} from '../sample-data/data';
import reactData from '../sample-data/react';
import {initEditor, PropertyList, BlockStage, NodeTree} from '../../src/editor';
import {DragDropDiv, DragState, DockLayout, DockContextType} from 'rc-dock';
import {ClientConnection} from '../../src/core/connect/ClientConnection';

import './sample-blocks';
import {WorkerFunction} from '../../src/core/worker/WorkerFunction';

import {TicloLayoutContext, TicloLayoutContextType} from '../../src/editor/component/LayoutContext';
import {PropertyListPane} from '../../src/editor/dock/property/PropertyListPane';
import {NodeTreePane} from '../../src/editor/dock/node-tree/NodeTreePane';
import {TextEditorPane} from '../../src/editor/dock/text-editor/TextEditorPane';
import '../../src/html';
import '../../src/react';
import '../../src/test';
import {FunctionSelect} from '../../src/editor/function-selector/FunctionSelector';
import JsonEsc from 'jsonesc/dist';

import i18next from 'i18next';
// @ts-ignore
import zhLocal from '../../i18n/editor/zh.json';

// @ts-ignore
import zhMathLocal from '../../i18n/core/zh.json';
// @ts-ignore
import zhReactLocal from '../../i18n/react/zh.json';
// @ts-ignore
import zhTestLocal from '../../i18n/test/zh.json';

// @ts-ignore
import enMathLocal from '../../i18n/core/en.json';
// @ts-ignore
import enReactLocal from '../../i18n/react/en.json';
// @ts-ignore
import enTestLocal from '../../i18n/test/en.json';

import zhAntd from 'antd/lib/locale/zh_CN';
import enAntd from 'antd/lib/locale/en_US';
import {LocalizedLabel, t} from '../../src/editor/component/LocalizedLabel';
import {IndexDbStorage} from '../../src/html/storage/IndexDbStorage';

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

interface Props {
  conn: ClientConnection;
}

interface State {
  modal?: React.ReactElement;
}

WorkerFunction.registerType(
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
                        <Switch
                          checkedChildren="zh"
                          unCheckedChildren="en"
                          defaultChecked={this.lng === 'zh'}
                          onChange={
                            // tslint:disable-next-line:jsx-no-lambda
                            (checked: boolean) => {
                              this.switchLan(checked ? 'zh' : 'en');
                            }
                          }
                        />
                        <br />
                        <Checkbox
                          defaultChecked={TicloI18nSettings.shouldTranslateFunction}
                          onChange={
                            // tslint:disable-next-line:jsx-no-lambda
                            (e) => {
                              TicloI18nSettings.shouldTranslateFunction = e.target.checked;
                              this.switchLan(this.lng);
                            }
                          }
                        >
                          translate function
                        </Checkbox>
                        <br />
                        <Checkbox
                          defaultChecked={TicloI18nSettings.useLocalizedBlockName}
                          onChange={
                            // tslint:disable-next-line:jsx-no-lambda
                            (e) => {
                              TicloI18nSettings.useLocalizedBlockName = e.target.checked;
                            }
                          }
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

  lng: string = 'zh';
  lngConfig = zhAntd;
  switchLan = (lng: string) => {
    this.lng = lng;
    this.lngConfig = lng === 'zh' ? zhAntd : enAntd;
    // force a reload of the context
    this.ticloContext = {...this.ticloContext};
    i18next.changeLanguage(lng, this.forceUpdateImmediate);
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
  await initEditor();

  await i18next.init({lng: 'zh'});
  i18next.addResourceBundle('zh', 'ticlo-editor', zhLocal);
  i18next.addResourceBundle('zh', 'ticlo-core', zhMathLocal);
  i18next.addResourceBundle('en', 'ticlo-core', enMathLocal);
  i18next.addResourceBundle('zh', 'ticlo-react', zhReactLocal);
  i18next.addResourceBundle('en', 'ticlo-react', enReactLocal);
  i18next.addResourceBundle('zh', 'ticlo-test', zhTestLocal);
  i18next.addResourceBundle('en', 'ticlo-test', enTestLocal);

  await Root.instance.setStorage(new IndexDbStorage());
  if (!(Root.instance.getValue('example') instanceof Flow)) {
    console.log('initialize the database');
    Root.instance.addFlow('example', reactData);
    Root.instance.addFlow('example0', data);
  }

  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd')?.setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub')?.setValue('#is', 'subtract');

  let [server, client] = makeLocalConnection(Root.instance);

  ReactDOM.render(<App conn={client} />, document.getElementById('app'));
})();

(window as any).Logger = Logger;
