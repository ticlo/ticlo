import React, {StrictMode, useContext, useEffect, useRef} from 'react';
import {Button, Checkbox, ConfigProvider, Radio, type RadioChangeEvent} from 'antd';
import {Root, Flow, Logger, PropDispatcher, TicloI18nSettings, addConsoleLogger} from '@ticlo/core';
import type {ClientConn, EditPolicy, PropDesc} from '@ticlo/core';
import {ClientConnection} from '@ticlo/core/connect/ClientConnection.ts';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {DesignerNodeTree, DesignerStage, useActiveDesignerStage} from '@ticlo/designer';
import {initEditor} from '@ticlo/editor';
import {TicloApp} from '@ticlo/editor/component/TicloApp.tsx';
import {
  TicloCurrentFlowConsumer,
  TicloCurrentFlowContext,
  type TicloLayoutContext,
} from '@ticlo/editor/component/LayoutContext.ts';
import {EditPolicyProvider} from '@ticlo/editor/component/EditPolicyContext.tsx';
import {NodeTreePane} from '@ticlo/editor/dock/node-tree/NodeTreePane.tsx';
import {PropertyListPane} from '@ticlo/editor/dock/property/PropertyListPane.tsx';
import {TextEditorPane} from '@ticlo/editor/dock/text-editor/TextEditorPane.tsx';
import {SchedulePane} from '@ticlo/editor/dock/schedule/SchedulePane.tsx';
import {FunctionSelect} from '@ticlo/editor/function-selector/FunctionSelect.tsx';
import {theme} from '@ticlo/editor/style/theme.ts';
import {t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {FrameServerConnection} from '@ticlo/html';
import {IndexDbFlowStorage} from '@ticlo/html/storage/IndexDbStorage.ts';
import {FileServerFlowStorage, TicloFileClient} from '@ticlo/remote-storage';
import {DockLayout, type PanelData, type TabData} from 'rc-dock';
import {createRoot} from 'react-dom/client';
import i18next from 'i18next';
import '@ticlo/react';
import '@ticlo/test';
import './sample-blocks.ts';
import {PolicyPanel} from './PolicyPanel.tsx';
import {PlaygroundConnection, PlaygroundConnectionContext} from './PlaygroundConnection.tsx';
import {designerData} from './sample-data/designer.ts';

import zhLocal from '../i18n/editor/zh.json' with {type: 'json'};
import enLocal from '../i18n/editor/en.json' with {type: 'json'};
import frLocal from '../i18n/editor/fr.json' with {type: 'json'};
import zhMathLocal from '../i18n/core/zh.json' with {type: 'json'};
import enMathLocal from '../i18n/core/en.json' with {type: 'json'};
import frMathLocal from '../i18n/core/fr.json' with {type: 'json'};
import zhReactLocal from '../i18n/react/zh.json' with {type: 'json'};
import enReactLocal from '../i18n/react/en.json' with {type: 'json'};
import frReactLocal from '../i18n/react/fr.json' with {type: 'json'};
import zhTestLocal from '../i18n/test/zh.json' with {type: 'json'};
import enTestLocal from '../i18n/test/en.json' with {type: 'json'};
import frTestLocal from '../i18n/test/fr.json' with {type: 'json'};
import zhAntd from 'antd/es/locale/zh_CN.js';
import enAntd from 'antd/es/locale/en_US.js';
import frAntd from 'antd/es/locale/fr_FR.js';
import type {Locale} from 'antd/es/locale/index.js';

function DesignerPanelFocus({panel}: {panel: PanelData}): null {
  const context = useContext(TicloCurrentFlowContext);
  const contextRef = useRef(context);
  contextRef.current = context;
  const path = panel.activeId?.slice('designer:'.length);
  useEffect(() => {
    if (path) contextRef.current.onFlowFocus(path);
  }, [path]);
  return null;
}

function DesignerSelectionSync({onSelect}: {onSelect: (paths: string[]) => void}): null {
  const stage = useActiveDesignerStage();
  const paths = stage?.selection.paths;
  useEffect(() => onSelect(paths ?? []), [onSelect, paths]);
  return null;
}

function ToolBox({openEditor}: {openEditor: (path: string) => void}) {
  const stage = useActiveDesignerStage();
  return (
    <div style={{padding: 12}}>
      <Button disabled={!stage?.flow} onClick={() => openEditor(stage.basePath)}>
        Open Editor
      </Button>
    </div>
  );
}

const layoutGroups = {
  designerStage: {
    animated: false,
    floatable: true,
    maximizable: true,
    panelExtra: (panel: PanelData) => <DesignerPanelFocus panel={panel} />,
  },
  tool: {
    floatable: true,
    maximizable: true,
    newWindow: true,
  },
};

const languages = ['en', 'fr', 'zh'];
const antdLanMap: Record<string, Locale> = {
  en: enAntd as unknown as Locale,
  fr: frAntd as unknown as Locale,
  zh: zhAntd as unknown as Locale,
};

interface Props {
  root: Root;
  conn: ClientConnection;
  initialFlow?: string;
}

interface State {
  conn: ClientConn;
  modal?: React.ReactElement;
}

class App extends React.PureComponent<Props, State> {
  state: State = {conn: this.props.conn};
  get conn() {
    return this.state.conn;
  }
  changePolicy = (policy?: EditPolicy) => {
    this.setState({conn: this.props.conn.withPolicy(policy)});
  };
  defaultDockLayout: any;
  constructor(props: Props) {
    super(props);
    const {conn, initialFlow} = props;
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
                    id: 'Policy',
                    title: 'Policy',
                    cached: true,
                    content: <PolicyPanel onChange={this.changePolicy} />,
                  },
                  {
                    group: 'tool',
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
                    group: 'tool',
                    id: 'Functions',
                    title: t('Functions'),
                    cached: true,
                    content: (
                      <TicloCurrentFlowConsumer>
                        {({currentPath}) => {
                          return (
                            <FunctionSelect conn={conn} funcLib={currentPath ? `${currentPath}.#lib` : undefined} />
                          );
                        }}
                      </TicloCurrentFlowConsumer>
                    ),
                  },
                  {
                    group: 'tool',
                    id: 'Properties',
                    title: t('Properties'),
                    cached: true,
                    content: (
                      <PlaygroundConnection>
                        <PropertyListPane conn={conn} />
                      </PlaygroundConnection>
                    ),
                  },
                ],
              },
            ],
          },
          {
            size: 800,
            tabs: initialFlow ? [this.createDesignerTab(initialFlow)] : [],
            id: 'main',
            panelLock: {panelStyle: 'main'},
          },
          {
            mode: 'vertical',
            size: 280,
            children: [
              {
                size: 150,
                tabs: [
                  {
                    group: 'tool',
                    id: 'ToolBox',
                    title: 'ToolBox',
                    cached: true,
                    content: <ToolBox openEditor={this.openEditor} />,
                  },
                ],
              },
              {
                size: 600,
                tabs: [
                  {
                    group: 'tool',
                    id: 'Components',
                    title: 'Components',
                    cached: true,
                    content: <DesignerNodeTree />,
                  },
                ],
              },
            ],
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
      if (!this.layout.updateTab(`designer:${path}`, null, true)) {
        this.layout.dockMove(this.createDesignerTab(path), this.layout.find('main'), 'middle');
      }
    },

    editProperty: (paths: string[], propDesc: PropDesc, defaultValue?: any, mime?: string, readonly?: boolean) => {
      const conn = this.conn;
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
      const conn = this.conn;
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

  createDesignerTab(path: string): TabData {
    return {
      id: `designer:${path}`,
      title: (
        <TicloCurrentFlowConsumer>
          {({onFlowFocus}) => <span onClick={() => onFlowFocus(path)}>{path}</span>}
        </TicloCurrentFlowConsumer>
      ),
      group: 'designerStage',
      closable: true,
      content: (
        <PlaygroundConnection>
          <DesignerStage root={this.props.root} conn={this.conn} basePath={path} />
        </PlaygroundConnection>
      ),
    };
  }

  editors: {window: Window; connection: FrameServerConnection}[] = [];
  openEditor = (path?: string) => {
    const url = new URL('editor.html', location.href);
    if (path) url.searchParams.set('flow', path);
    const editor = window.open(url.href, '_blank');
    if (editor) this.editors.push({window: editor, connection: new FrameServerConnection(editor, this.props.root)});
  };
  closeEditors = () => {
    for (const editor of this.editors) {
      editor.connection.destroy();
      if (!editor.window.closed) editor.window.close();
    }
    this.editors = [];
  };
  componentDidMount() {
    window.addEventListener('beforeunload', this.closeEditors);
  }
  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.closeEditors);
    this.closeEditors();
  }

  render() {
    const conn = this.conn;
    const {modal} = this.state;
    const appContent = (
      <PlaygroundConnectionContext.Provider value={conn}>
        <EditPolicyProvider conn={conn}>
          <TicloApp value={this.ticloContext}>
            <DesignerSelectionSync onSelect={this.onSelect} />
            <DockLayout
              defaultLayout={this.defaultDockLayout}
              ref={this.getLayout}
              groups={layoutGroups}
              style={{position: 'absolute', left: 10, top: 10, right: 10, bottom: 10}}
            />
            {modal}
          </TicloApp>
        </EditPolicyProvider>
      </PlaygroundConnectionContext.Provider>
    );

    if (location.hash.includes('strictMode')) {
      return (
        <ConfigProvider locale={this.lngConfig} theme={theme}>
          <StrictMode>{appContent}</StrictMode>
        </ConfigProvider>
      );
    } else {
      return (
        <ConfigProvider locale={this.lngConfig} theme={theme}>
          {appContent}
        </ConfigProvider>
      );
    }
  }
}

window.addEventListener('hashchange', () => location.reload());

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

  const params = new URLSearchParams(location.hash.slice(1));
  const host = params.get('host');
  const root = Root.instance;
  let initialFlow: string;
  if (host) {
    const client = new TicloFileClient({baseURL: host});
    const project = params.get('project') || '#root';
    await root.setStorage(new FileServerFlowStorage(client));
    await root.start(
      params.has('project') || params.has('flow') ? {[project]: {flows: params.getAll('flow')}} : undefined
    );
    const firstFlow = (await root.listFlows(project)).find(({state}) => state !== 'unloaded');
    if (firstFlow) initialFlow = project === '#root' ? firstFlow.name : `+${project}.${firstFlow.name}`;
  } else {
    await root.setStorage(new IndexDbFlowStorage());
    await root._storage.saveNamespaceMetadata('demo', {});
    await root.start({'#root': {flows: ['**']}, 'demo': {}});

    if (!(root.getValue('designer-example') instanceof Flow)) {
      root.addFlow('designer-example', designerData);
    }
    initialFlow = params.get('flow') || 'designer-example';
  }

  const [server, client] = makeLocalConnection(root, true, undefined, false);
  createRoot(document.getElementById('app')).render(<App root={root} conn={client} initialFlow={initialFlow} />);
})().catch((error) => {
  console.error(error);
  document.getElementById('app').textContent = `Failed to load designer: ${error.message}`;
});

(window as any).Logger = Logger;
addConsoleLogger(Logger.TRACE_AND_ABOVE);
