import './styles.ts';
import * as React from 'react';
import {StrictMode} from 'react';
import {App as AntdApp} from 'antd';
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
import {AppHeader, AppTheme, appHeaderHeight} from './AppHeader.tsx';
import {FileMenuHeader} from './FileMenu.tsx';
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
import '@ticlo/chart';
import '@ticlo/chart/style/index.css';
import '@ticlo/test';
import {FunctionSelect} from '@ticlo/editor/function-selector/FunctionSelect.tsx';

import i18next from 'i18next';

import {LocalizedLabel, t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {BROWSER_LOCAL_LIBRARY, RemoteStorage, StaticStorage} from '@ticlo/remote-storage';
import type {FileEntry, ProjectFiles} from '@ticlo/core/storage/FileAccess.ts';
import {createRoot} from 'react-dom/client';
import {Library} from '@ticlo/core/block/Library.ts';
import {EditPolicyProvider} from '@ticlo/editor/component/EditPolicyContext.tsx';
import {PolicyPanel} from './PolicyPanel.tsx';
import {StageConnection, StageConnectionContext, connectStageTab} from './StageConnection.tsx';
import type {ClientConn, EditPolicy} from '@ticlo/core';
import {fileFlowPath} from './flow-path.ts';
import {reloadDiscardedFileFlow, resetProjectFlows, unloadDeletedFileFlows} from './file-flow-lifecycle.ts';
import {requestCallbacks} from '@ticlo/editor/util/RequestCallbacks.ts';
import {useLibrarySelection} from './useLibrarySelection.ts';
import {createModuleAutoLoad} from './module-auto-load.ts';
import type {LibrarySelectionOptions} from '@ticlo/editor/library/LibrarySelectDialog.tsx';
import {initialUrlParams} from './url-state.ts';

const FileVersionContext = React.createContext(0);
const strictMode = initialUrlParams().has('strictMode');

function DataflowFiles({
  storage,
  project,
  onOpen,
  onFilesDeleted,
  onFileDiscarded,
  onProjectReset,
}: {
  storage: ProjectFiles;
  project: string;
  onOpen: (entry: FileEntry) => Promise<void>;
  onFilesDeleted: (paths: string[]) => Promise<void>;
  onFileDiscarded: (path: string) => Promise<void>;
  onProjectReset: () => Promise<void>;
}) {
  const version = React.useContext(FileVersionContext);
  return (
    <FileManager
      key={version}
      storage={storage}
      project={project}
      onOpen={onOpen}
      onFilesDeleted={onFilesDeleted}
      onFileDiscarded={onFileDiscarded}
      onProjectReset={onProjectReset}
    />
  );
}

const layoutGroups = {
  main: stageGroup,
  tool: toolGroup,
};

interface Props {
  conn: ClientConnection;
  initialFlow?: string;
  files?: {storage: ProjectFiles; project: string};
  onLibraryChange: (name: string, options: LibrarySelectionOptions) => Promise<void>;
  onLibraryUnload: (name: string) => Promise<void>;
  onSetDefaultLibrary: (name: string) => Promise<void>;
}

interface State {
  conn: ClientConn;
  modal?: React.ReactElement;
  fileVersion: number;
}

class App extends React.PureComponent<Props, State> {
  state: State = {conn: this.props.conn, fileVersion: 0};
  moduleAutoLoad = createModuleAutoLoad(Root.instance);
  get conn() {
    return this.state.conn;
  }
  changePolicy = (policy?: EditPolicy) => {
    this.setState({conn: this.props.conn.withPolicy(policy)});
  };
  onFilesChange = () => this.setState(({fileVersion}) => ({fileVersion: fileVersion + 1}));
  openFlow = (path: string) => {
    const onSave = stageReadonly(this.props.files?.storage, path)
      ? null
      : () => {
          this.conn.applyFlowChange(path, undefined, requestCallbacks);
        };
    this.ticloContext.editFlow?.(path, onSave);
  };
  openStoredFile = async (entry: FileEntry) => {
    const target = fileFlowPath(this.props.files.project, entry.path);
    if (!target) throw new Error('This file is not a loadable flow.');
    if (!this.conn.getEditPolicyView().can({cmd: 'loadFlow', path: target.path}))
      throw new Error('Opening this flow is not permitted.');
    await Root.instance.loadFlow(target.ref);
    this.openFlow(target.path);
  };
  onFilesDeleted = (paths: string[]) =>
    unloadDeletedFileFlows(Root.instance, this.layout, this.props.files.project, paths);
  onFileDiscarded = (path: string) => reloadDiscardedFileFlow(Root.instance, this.props.files.project, path);
  onProjectReset = () =>
    resetProjectFlows(Root.instance, this.layout, this.props.files.storage, this.props.files.project);
  defaultDockLayout: LayoutBase;
  tabs: TabDefinitions;
  constructor(props: Props) {
    super(props);
    const {conn, initialFlow} = props;
    const initialTab = initialFlow
      ? this.createBlockEditorTab(initialFlow, () =>
          this.conn.applyFlowChange(initialFlow, undefined, requestCallbacks)
        )
      : undefined;
    this.tabs = {
      'Navigation': {
        group: 'tool',
        title: t('Navigation'),
        cached: true,
        content: (
          <NodeTreePane
            conn={conn}
            basePaths={['']}
            hideRoot={true}
            onSelect={this.onSelect}
            showMenu={true}
            moduleAutoLoad={this.moduleAutoLoad}
            showStoredFlows
          />
        ),
      },
      'Policy': {
        group: 'tool',
        title: 'Policy',
        cached: true,
        content: <PolicyPanel onChange={this.changePolicy} />,
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
                  funcModule={currentPath ? `${currentPath}.#module` : undefined}
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
          <StageConnection>
            <PropertyListPane conn={conn} />
          </StageConnection>
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
          content: (
            <DataflowFiles
              {...props.files}
              onOpen={this.openStoredFile}
              onFilesDeleted={this.onFilesDeleted}
              onFileDiscarded={this.onFileDiscarded}
              onProjectReset={this.onProjectReset}
            />
          ),
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
  switchLan = (language: string) => {
    this.lng = language;
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
        <StageConnectionContext.Provider value={conn}>
          <EditPolicyProvider conn={conn}>
            <FileVersionContext.Provider value={this.state.fileVersion}>
              <TicloApp value={this.ticloContext} defaultLibrary={this.props.files?.project}>
                {this.props.files ? (
                  <FileMenuHeader
                    language={this.lng}
                    onLanguageChange={this.switchLan}
                    root={Root.instance}
                    conn={conn}
                    files={this.props.files}
                    onOpen={this.openFlow}
                    onChange={this.onFilesChange}
                    onLibraryChange={this.props.onLibraryChange}
                    onLibraryUnload={this.props.onLibraryUnload}
                    onSetDefaultLibrary={this.props.onSetDefaultLibrary}
                  />
                ) : (
                  <AppHeader language={this.lng} onLanguageChange={this.switchLan} />
                )}
                <DockLayout
                  defaultLayout={this.defaultDockLayout}
                  tabs={this.tabs}
                  sideColumns={leftSideColumns}
                  ref={this.getLayout}
                  groups={layoutGroups}
                  style={{position: 'absolute', left: 0, top: appHeaderHeight + 4, right: 4, bottom: 4}}
                />
                {modal}
              </TicloApp>
            </FileVersionContext.Provider>
          </EditPolicyProvider>
        </StageConnectionContext.Provider>
      </AntdApp>
    );

    return (
      <AppTheme locale={this.lngConfig}>{strictMode ? <StrictMode>{appContent}</StrictMode> : appContent}</AppTheme>
    );
  }
}

function DataflowWorkspace({
  conn,
  initialFlow,
  files,
}: {
  conn: ClientConnection;
  initialFlow?: string;
  files: {storage: ProjectFiles; project: string};
}) {
  const selection = useLibrarySelection(conn, files.project, initialFlow);
  return (
    <App
      key={selection.project}
      conn={conn}
      initialFlow={selection.initialFlow}
      files={{...files, project: selection.project}}
      onLibraryChange={selection.selectLibrary}
      onLibraryUnload={selection.unloadLibrary}
      onSetDefaultLibrary={selection.setDefaultLibrary}
    />
  );
}

(async () => {
  addConsoleLogger();
  await initEditor();

  await initAppI18n();

  const params = initialUrlParams();
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
      params.has('flow')
        ? {[project]: {flows: params.getAll('flow')}}
        : params.has('project')
          ? {[project]: {}}
          : undefined
    );
    const firstFlow = (await root.listFlows(project)).find(({state}) => state !== 'unloaded');
    if (firstFlow) initialFlow = project === '#root' ? firstFlow.name : `+${project}.${firstFlow.name}`;
  } else {
    const storage = new StaticStorage(new URL('./storage', location.href).href);
    const project = params.get('project') || BROWSER_LOCAL_LIBRARY;
    const example = `+${BROWSER_LOCAL_LIBRARY}.example`;
    files = {storage, project};
    await root.setStorage(storage);
    await root.start({[project]: params.has('project') ? {} : {flows: ['**']}});

    if (project === BROWSER_LOCAL_LIBRARY && !params.has('project') && !(root.queryValue(example) instanceof Flow)) {
      console.log('initialize the database');
      root.addFlow(example, reactData);
      root.addFlow(`+${BROWSER_LOCAL_LIBRARY}.example0`, data);
    }

    // create some global blocks
    root._globalRoot.createBlock('^gAdd')?.setValue('#is', 'add');
    root._globalRoot.createBlock('^gSub')?.setValue('#is', 'subtract');
    if (project === BROWSER_LOCAL_LIBRARY && !params.has('project')) initialFlow = example;
  }

  const [server, client] = makeLocalConnection(root);
  createRoot(document.getElementById('app')).render(
    <DataflowWorkspace conn={client} initialFlow={initialFlow} files={files} />
  );
})().catch((error) => {
  console.error(error);
  document.getElementById('app').textContent = `Failed to load dataflow editor: ${error.message}`;
});

(window as any).Logger = Logger;
addConsoleLogger(Logger.TRACE_AND_ABOVE);
