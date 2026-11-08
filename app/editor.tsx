import './styles.ts';
import * as React from 'react';
import {App as AntdApp} from 'antd';
import {Block, DataMap, decode, encodeSorted, FunctionDesc, Flow, Root, addConsoleLogger} from '@ticlo/core';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {data} from './sample-data/data.ts';
import reactData from './sample-data/react.ts';
import {initEditor, PropertyList, BlockStage, NodeTree, FileManager} from '@ticlo/editor';
import {DockLayout, type LayoutBase, type TabDefinitions, type TabData} from 'rc-dock';
import {leftSideColumns, stageGroup, toolGroup, createLayoutActions} from './AppLayout.ts';
import {antdLocales, initAppI18n} from './AppI18n.tsx';
import {AppHeader, AppTheme, appHeaderHeight} from './AppHeader.tsx';
import {ClientConnection, type CompletedRequest} from '@ticlo/core/connect/ClientConnection.ts';
import {globalFunctions} from '@ticlo/core';
import {FunctionTree} from '@ticlo/editor/function-selector/FunctionTree.tsx';

import './sample-blocks.ts';
import {Logger} from '@ticlo/core/util/Logger.ts';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';
import {BlockStagePane} from '@ticlo/editor/dock/block/BlockStagePane.tsx';
import {TicloApp} from '@ticlo/editor/component/TicloApp.tsx';
import {TicloCurrentFlowConsumer, TicloLayoutContext} from '@ticlo/editor/component/LayoutContext.ts';
import {PropDispatcher} from '@ticlo/core/block/Dispatcher.ts';
import {PropertyListPane} from '@ticlo/editor/dock/property/PropertyListPane.tsx';
import {WsBrowserConnection} from '@ticlo/html/connect/WsBrowserConnection.ts';
import {FrameClientConnection} from '@ticlo/html/connect/FrameClientConnection.ts';
import {NodeTreePane} from '@ticlo/editor/dock/node-tree/NodeTreePane.tsx';

import '@ticlo/test';
import {FunctionSelect} from '@ticlo/editor/function-selector/FunctionSelect.tsx';

import i18next from 'i18next';

import {LocalizedLabel, t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {FlowTestCase} from '@ticlo/test/FlowTestCase.ts';
import {createRoot} from 'react-dom/client';
import {MixedBrowserConnection} from '@ticlo/html/connect/MixedBrowserConnection.ts';
import {Namespace} from '@ticlo/core/block/Namespace.ts';
import {initialUrlParams} from './url-state.ts';
import {requestCallbacks} from '@ticlo/editor/util/RequestCallbacks.ts';
import {flowRefFromPath} from '@ticlo/core/block/FlowRuntime.ts';
import {flowStoragePath} from '@ticlo/core/util/FlowStoragePath.ts';
import {namespacePrefix} from '@ticlo/core/util/NamespaceMetadata.ts';
import {type FileAccess, type FileEntry, StorageError} from '@ticlo/core/storage/FileAccess.ts';
import {fileFlowPath} from './flow-path.ts';
import {editorHostUrls} from './editor-host.ts';
import {RemoteStorage, ScopedFileServerFiles, StaticStorage} from '@ticlo/remote-storage';

const layoutGroups = {
  main: stageGroup,
  tool: toolGroup,
};

interface Props {
  conn: ClientConnection;
  initialFlow?: string;
  files?: {storage: FileAccess; project: string};
}

interface State {
  modal?: React.ReactElement;
}

WorkerFunctionGen.registerType({'#is': ''}, {name: 'class1'}, '+WorkerEditor');

class App extends React.PureComponent<Props, State> {
  state: State = {};
  private onFlowRequestCompleted = (request: CompletedRequest) => {
    const {files} = this.props;
    if (!files) return;
    const {cmd} = request;
    if (
      cmd !== 'applyFlowChange' &&
      cmd !== 'addFlow' &&
      cmd !== 'addFlowFolder' &&
      cmd !== 'setAutoLoadFlow' &&
      cmd !== 'deleteBlock' &&
      !(cmd === 'deleteFunction' && typeof request.funcId === 'string' && request.funcId.startsWith('+')) &&
      !((cmd === 'enableFlow' || cmd === 'disableFlow') && request.persist)
    )
      return;
    if (cmd === 'applyFlowChange') {
      // A worker editor can save a function into a different flow than its own path.
      files.storage.notifyFileChange?.(files.project);
      return;
    }
    const path = cmd === 'deleteFunction' ? request.funcId : request.path;
    if (typeof path !== 'string') return;
    if (path === `+${files.project}`) {
      files.storage.notifyFileChange?.(files.project);
      return;
    }
    try {
      if (flowRefFromPath(path).namespace === files.project) files.storage.notifyFileChange?.(files.project);
    } catch {
      // Some valid block operations use a namespace root rather than a flow path.
    }
  };

  componentDidMount() {
    this.props.conn.completedRequests().listen(this.onFlowRequestCompleted);
  }

  componentWillUnmount() {
    this.props.conn.completedRequests().unlisten(this.onFlowRequestCompleted);
  }
  defaultDockLayout: LayoutBase;
  tabs: TabDefinitions;
  constructor(props: Props) {
    super(props);
    const {conn, initialFlow} = props;
    const initialTab = initialFlow
      ? this.createBlockEditorTab(initialFlow, () => this.saveFlow(initialFlow))
      : undefined;
    this.tabs = {
      Navigation: {
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
            showStoredFlows
          />
        ),
      },
      Functions: {
        group: 'tool',
        title: t('Functions'),
        cached: true,
        content: (
          <TicloCurrentFlowConsumer>
            {({currentPath, activeStage}) => (
              <FunctionSelect
                conn={conn}
                funcLib={currentPath ? `${currentPath}.#lib` : undefined}
                tags={activeStage?.functionTreeTags}
              />
            )}
          </TicloCurrentFlowConsumer>
        ),
      },
      Properties: {
        group: 'tool',
        title: t('Properties'),
        cached: true,
        content: <PropertyListPane conn={conn} />,
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
            <FileManager
              storage={props.files.storage}
              project={props.files.project}
              onOpen={this.openFile}
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
                tabs: [...(props.files ? [{id: 'Files'}] : []), {id: 'Navigation'}],
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
      () => this.props.conn
    ),
    getSelectedPaths: () => this.selectedPaths,
    showModal: (modal: React.ReactElement) => this.setState({modal}),
  };

  openFile = async (entry: FileEntry) => {
    const target = fileFlowPath(this.props.files.project, entry.path);
    if (!target) throw new Error('Select a .ticlo file.');
    await this.props.conn.loadFlow(target.path);
    this.ticloContext.editFlow(target.path, () => this.saveFlow(target.path));
  };

  saveFlow = (path: string) => {
    this.props.conn.applyFlowChange(path, undefined, requestCallbacks);
  };

  onFilesDeleted = async (paths: string[]) => {
    for (const file of paths) {
      const target = fileFlowPath(this.props.files.project, file);
      if (!target) continue;
      await this.props.conn.unloadFlow(target.path, {discardChanges: true});
      const tab = this.layout.find(`blockEditor:${target.path}`) as TabData | undefined;
      if (tab) this.layout.dockMove(tab, null, 'remove');
    }
  };

  onFileDiscarded = async (file: string) => {
    const target = fileFlowPath(this.props.files.project, file);
    if (!target || (await this.props.conn.getFlowState(target.path))?.state === 'unloaded') return;
    await this.props.conn.unloadFlow(target.path, {discardChanges: true});
    await this.props.conn.loadFlow(target.path);
  };

  onProjectReset = async () => {
    const {storage, project} = this.props.files;
    const {flows} = await this.props.conn.listLoadedFlows(project);
    for (const ref of flows) {
      const path = `${namespacePrefix(project)}${ref.kind === 'library' ? ':' : ''}${ref.name}`;
      const file = `${project}/${flowStoragePath(ref.kind === 'library' ? `:${ref.name}` : ref.name)}`;
      let exists = false;
      try {
        exists = (await storage.getFileInfo(file)).gitStatus !== 'deleted';
      } catch (error) {
        if (!(error instanceof StorageError && error.code === 'not-found')) throw error;
      }
      await this.props.conn.unloadFlow(path, {discardChanges: true});
      if (exists) await this.props.conn.loadFlow(path);
      else {
        const tab = this.layout.find(`blockEditor:${path}`) as TabData | undefined;
        if (tab) this.layout.dockMove(tab, null, 'remove');
      }
    }
  };

  selectedPaths: PropDispatcher<string[]> = new PropDispatcher();

  onSelect = (paths: string[], handled: boolean = false) => {
    if (!handled) {
      this.selectedPaths.updateValue(paths);
    }
  };

  createBlockEditorTab(path: string, onSave?: () => void) {
    const {conn} = this.props;
    return BlockStagePane.createDockTab(path, conn, this.onSelect, onSave);
  }

  render() {
    const {conn} = this.props;
    const {modal} = this.state;
    return (
      <AppTheme locale={this.lngConfig}>
        <AntdApp style={{height: '100%', backgroundColor: 'var(--ant-color-bg-layout)'}}>
          <TicloApp value={this.ticloContext}>
            <AppHeader language={this.lng} onLanguageChange={this.switchLan} showProjectMenus={false} />
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
        </AntdApp>
      </AppTheme>
    );
  }
}

(async () => {
  await initEditor();
  await initAppI18n();

  const params = initialUrlParams();
  const initialFlow = params.get('flow') || undefined;
  const project = params.get('project') || (initialFlow ? flowRefFromPath(initialFlow).namespace : '#root');
  const host = window.opener ? undefined : editorHostUrls(params.get('host'));
  const client = window.opener
    ? new FrameClientConnection(window.opener) // used by server-window.html
    : new MixedBrowserConnection(host.runtimeUrl);
  const fileHost = params.get('fileHost');
  const files = fileHost
    ? {storage: new RemoteStorage({baseURL: fileHost}), project}
    : params.get('storage') === 'static'
      ? {storage: new StaticStorage(new URL('./storage', location.href).href), project}
      : host?.fileUrl
        ? {storage: new ScopedFileServerFiles(host.fileUrl, 'serv'), project}
        : undefined;
  createRoot(document.getElementById('app')).render(<App conn={client} initialFlow={initialFlow} files={files} />);
})();

(window as any).Logger = Logger;
// addConsoleLogger(Logger.TRACE_AND_ABOVE);
