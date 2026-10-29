import './styles.ts';
import * as React from 'react';
import {StrictMode} from 'react';
import {App as AntdApp, type RadioChangeEvent} from 'antd';
import {
  Block,
  DataMap,
  decode,
  encodeSorted,
  FunctionDesc,
  Logger,
  addConsoleLogger,
  PropDispatcher,
  Flow,
  Root,
  FlowStorage,
  BlockProperty,
} from '@ticlo/core';
import {BlockStagePane} from '@ticlo/editor/dock/block/BlockStagePane.tsx';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {data} from './sample-data/data.ts';
import reactData from './sample-data/react.ts';
import {initEditor, PropertyList, BlockStage, NodeTree, FileManager} from '@ticlo/editor';
import {DockLayout, type LayoutBase, type TabDefinitions} from 'rc-dock';
import {leftSideColumns, stageGroup, toolGroup, createLayoutActions, stageReadonly} from './AppLayout.ts';
import {antdLocales, initAppI18n} from './AppI18n.tsx';
import {AppTheme, AppToolBox} from './AppToolBox.tsx';
import {ClientConnection} from '@ticlo/core/connect/ClientConnection.ts';

import './sample-blocks.ts';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';

import {TicloApp} from '@ticlo/editor/component/TicloApp.tsx';
import {
  TicloCurrentFlowConsumer,
  TicloLayoutContext,
  TicloLayoutContextType,
} from '@ticlo/editor/component/LayoutContext.ts';
import {PropertyListPane} from '@ticlo/editor/dock/property/PropertyListPane.tsx';
import {NodeTreePane} from '@ticlo/editor/dock/node-tree/NodeTreePane.tsx';
import '@ticlo/html';
import '@ticlo/react';
import '@ticlo/test';
import {FunctionSelect} from '@ticlo/editor/function-selector/FunctionSelect.tsx';

import i18next from 'i18next';

import {LocalizedLabel, t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {RemoteStorage, StaticStorage} from '@ticlo/remote-storage';
import type {ProjectFiles} from '@ticlo/core/storage/FileAccess.ts';
import {createRoot} from 'react-dom/client';
import {Namespace} from '@ticlo/core/block/Namespace.ts';
import {EditPolicyProvider} from '@ticlo/editor/component/EditPolicyContext.tsx';
import {PolicyPanel} from './PolicyPanel.tsx';
import {PlaygroundConnection, PlaygroundConnectionContext, connectStageTab} from './PlaygroundConnection.tsx';
import type {ClientConn, EditPolicy} from '@ticlo/core';

const layoutGroups = {
  main: stageGroup,
  tool: toolGroup,
};

interface Props {
  conn: ClientConnection;
  initialFlow?: string;
  files?: {storage: ProjectFiles; project: string};
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
  defaultDockLayout: LayoutBase;
  tabs: TabDefinitions;
  constructor(props: Props) {
    super(props);
    const {conn, initialFlow} = props;
    const initialTab = initialFlow
      ? this.createBlockEditorTab(initialFlow, () => this.conn.applyFlowChange(initialFlow))
      : undefined;
    this.tabs = {
      'Navigation': {
        group: 'tool',
        title: t('Navigation'),
        cached: true,
        content: <NodeTreePane conn={conn} basePaths={['']} hideRoot={true} onSelect={this.onSelect} showMenu={true} />,
      },
      'Policy': {
        group: 'tool',
        title: 'Policy',
        cached: true,
        content: <PolicyPanel onChange={this.changePolicy} />,
      },
      'ToolBox': {
        group: 'tool',
        title: 'ToolBox',
        minHeight: 210,
        cached: true,
        content: <AppToolBox switchLan={this.switchLan} />,
      },
      'Functions': {
        group: 'tool',
        title: t('Functions'),
        cached: true,
        content: (
          <TicloCurrentFlowConsumer>
            {({currentPath, activeStage}) => {
              return (
                <FunctionSelect
                  conn={conn}
                  funcLib={currentPath ? `${currentPath}.#lib` : undefined}
                  tags={activeStage?.functionTreeTags}
                />
              );
            }}
          </TicloCurrentFlowConsumer>
        ),
      },
      'Properties': {
        group: 'tool',
        title: t('Properties'),
        cached: true,
        content: (
          <PlaygroundConnection>
            <PropertyListPane conn={conn} />
          </PlaygroundConnection>
        ),
      },
      'Test UI': {
        group: 'tool',
        title: 'Test UI',
        cached: true,
        content: <div id="main" />,
      },
    };
    if (props.files) {
      this.tabs = {
        ...this.tabs,
        Files: {
          group: 'tool',
          title: t('Files'),
          cached: true,
          content: <FileManager {...props.files} />,
        },
      };
    }
    this.defaultDockLayout = {
      dockbox: {
        mode: 'horizontal',
        children: [
          {
            id: 'left',
            mode: 'vertical',
            size: 200,
            children: [
              {
                size: 210,
                tabs: [{id: 'ToolBox'}],
              },
              {
                size: 400,
                tabs: [{id: 'Navigation'}, ...(props.files ? [{id: 'Files'}] : []), {id: 'Policy'}],
              },
              {
                size: 300,
                tabs: [{id: 'Functions'}, {id: 'Properties'}],
              },
            ],
          },
          {
            size: 800,
            tabs: initialTab ? [initialTab] : [],
            id: 'main',
            panelLock: {panelStyle: 'main'},
          },
        ],
      },
      floatbox: {
        mode: 'float',
        children: [
          {
            w: 400,
            h: 400,
            // Keep the floating panel 16px from the viewport edges.
            floatAnchor: {right: 6, bottom: 6},
            tabs: [{id: 'Test UI'}],
          },
        ],
      },
    };
  }

  lng: string = 'en';
  lngConfig = antdLocales['en'];
  switchLan = (e?: RadioChangeEvent) => {
    this.lng = e?.target.value || this.lng;
    this.lngConfig = antdLocales[this.lng];
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
      if (!this.layout.updateTab(`blockEditor:${path}`, null, true)) {
        this.layout.dockMove(this.createBlockEditorTab(path, onSave), 'main', 'middle');
      }
    },

    ...createLayoutActions(
      () => this.layout,
      () => this.conn
    ),
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
    const conn = this.conn;
    const tab = BlockStagePane.createDockTab(path, conn, this.onSelect, onSave);
    return connectStageTab(tab, stageReadonly(this.props.files?.storage, path));
  }

  render() {
    const conn = this.conn;
    const {modal} = this.state;
    const appContent = (
      <AntdApp style={{height: '100%', backgroundColor: 'var(--ant-color-bg-layout)'}}>
        <PlaygroundConnectionContext.Provider value={conn}>
          <EditPolicyProvider conn={conn}>
            <TicloApp value={this.ticloContext}>
              <DockLayout
                defaultLayout={this.defaultDockLayout}
                tabs={this.tabs}
                sideColumns={leftSideColumns}
                ref={this.getLayout}
                groups={layoutGroups}
                style={{position: 'absolute', left: 0, top: 4, right: 4, bottom: 4}}
              />
              {modal}
            </TicloApp>
          </EditPolicyProvider>
        </PlaygroundConnectionContext.Provider>
      </AntdApp>
    );

    return (
      <AppTheme locale={this.lngConfig}>
        {location.hash.includes('strictMode') ? <StrictMode>{appContent}</StrictMode> : appContent}
      </AppTheme>
    );
  }
}

window.addEventListener('hashchange', () => location.reload());

(async () => {
  addConsoleLogger();
  await initEditor();

  await initAppI18n();

  const params = new URLSearchParams(location.hash.slice(1));
  const host = params.get('host');
  const root = Root.instance;
  let initialFlow: string;
  let files: Props['files'];
  if (host) {
    const storage = new RemoteStorage({baseURL: host});
    const project = params.get('project') || '#root';
    files = {storage, project};
    await root.setStorage(storage);
    await root.start(
      params.has('project') || params.has('flow') ? {[project]: {flows: params.getAll('flow')}} : undefined
    );
    const firstFlow = (await root.listFlows(project)).find(({state}) => state !== 'unloaded');
    if (firstFlow) initialFlow = project === '#root' ? firstFlow.name : `+${project}.${firstFlow.name}`;
  } else {
    const storage = new StaticStorage(new URL('./storage', location.href).href);
    files = {storage, project: 'local'};
    await root.setStorage(storage);
    await root.start({local: {flows: ['**']}});

    if (!(root.queryValue('+local.example') instanceof Flow)) {
      console.log('initialize the database');
      root.addFlow('+local.example', reactData);
      root.addFlow('+local.example0', data);
    }

    // create some global blocks
    root._globalRoot.createBlock('^gAdd')?.setValue('#is', 'add');
    root._globalRoot.createBlock('^gSub')?.setValue('#is', 'subtract');
    initialFlow = '+local.example';
  }

  const [server, client] = makeLocalConnection(root);
  createRoot(document.getElementById('app')).render(<App conn={client} initialFlow={initialFlow} files={files} />);
})().catch((error) => {
  console.error(error);
  document.getElementById('app').textContent = `Failed to load playground: ${error.message}`;
});

(window as any).Logger = Logger;
addConsoleLogger(Logger.TRACE_AND_ABOVE);
