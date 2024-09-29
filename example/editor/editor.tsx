import * as React from 'react';
import {Checkbox, ConfigProvider, Switch} from 'antd';
import {Block, DataMap, decode, encodeSorted, FunctionDesc, Flow, PropDesc, Root} from '../../src/core';
import {TicloI18nSettings} from '../../src/core/editor';
import {makeLocalConnection} from '../../src/core/connect/LocalConnection';
import {data} from '../sample-data/data';
import reactData from '../sample-data/react';
import {initEditor, PropertyList, BlockStage, NodeTree} from '../../src/editor';
import {DragDropDiv, DragState, DockLayout, DockContextType} from 'rc-dock';
import {ClientConnection} from '../../src/core/connect/ClientConnection';
import {Functions} from '../../src/core/block/Functions';
import {FunctionTree} from '../../src/editor/function-selector/FunctionTree';

import './sample-blocks';
import {Logger} from '../../src/core/util/Logger';
import {WorkerFunctionGen} from '../../src/core/worker/WorkerFunctionGen';
import {BlockStagePane} from '../../src/editor/dock/block/BlockStagePane';
import {TicloLayoutContext, TicloLayoutContextType} from '../../src/editor/component/LayoutContext';
import {PropDispatcher} from '../../src/core/block/Dispatcher';
import {PropertyListPane} from '../../src/editor/dock/property/PropertyListPane';
import {WsBrowserConnection} from '../../src/html/connect/WsBrowserConnection';
import {FrameClientConnection} from '../../src/html/connect/FrameClientConnection';
import {NodeTreePane} from '../../src/editor/dock/node-tree/NodeTreePane';
import {TextEditorPane} from '../../src/editor/dock/text-editor/TextEditorPane';

import '../../src/test';
import {FunctionSelect} from '../../src/editor/function-selector/FunctionSelector';

import i18next from 'i18next';

// @ts-ignore
import zhLocal from '../../i18n/editor/zh.json';
// @ts-ignore
import zhMathLocal from '../../i18n/core/zh.json';
// @ts-ignore
import zhTestLocal from '../../i18n/test/zh.json';

// @ts-ignore
import enLocal from '../../i18n/editor/en.json';
// @ts-ignore
import enMathLocal from '../../i18n/core/en.json';
// @ts-ignore
import enTestLocal from '../../i18n/test/en.json';

import zhAntd from 'antd/lib/locale/zh_CN';
import enAntd from 'antd/lib/locale/en_US';
import {LocalizedLabel, t} from '../../src/editor/component/LocalizedLabel';
import {FlowTestCase} from '../../src/test/FlowTestCase';
import {createRoot} from 'react-dom/client';
import {SchedulePane} from '../../src/editor/dock/schedule/SchedulePane';
const layoutGroups = {
  blockStage: {
    animated: false,
    floatable: true,
  },
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

  lng: string = 'zh';
  lngConfig = zhAntd;
  switchLan = (lng: string) => {
    this.lng = lng;
    this.lngConfig = lng === 'zh' ? zhAntd : enAntd;
    // force a reload of the context
    this.ticloContext = {...this.ticloContext, language: lng};
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
  await initEditor();
  await i18next.init({lng: 'zh'});
  i18next.addResourceBundle('zh', 'ticlo-editor', zhLocal);
  i18next.addResourceBundle('en', 'ticlo-editor', enLocal);
  i18next.addResourceBundle('zh', 'ticlo-core', zhMathLocal);
  i18next.addResourceBundle('en', 'ticlo-core', enMathLocal);
  i18next.addResourceBundle('zh', 'ticlo-test', zhTestLocal);
  i18next.addResourceBundle('en', 'ticlo-test', enTestLocal);

  let client = window.opener
    ? new FrameClientConnection(window.opener) // used by server-window.html
    : new WsBrowserConnection(`ws://127.0.0.1:8010/ticlo`); // used by express server
  createRoot(document.getElementById('app')).render(<App conn={client} />);
})();

(window as any).Logger = Logger;
