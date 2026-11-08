import './styles.ts';
import '@ticlo/designer/style/index.css';
import React, {StrictMode, useContext} from 'react';
import {App as AntdApp, Switch} from 'antd';
import {EditOutlined} from '@ant-design/icons';
import {Root, Flow, Logger, PropDispatcher, addConsoleLogger} from '@ticlo/core';
import {ClientConnection} from '@ticlo/core/connect/ClientConnection.ts';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {
  DesignerApp,
  DesignerLayoutContextType,
  DesignerNavigationTree,
  DesignerNodeTree,
  DesignerStage,
  type DesignerLayoutContext,
} from '@ticlo/designer';
import {initEditor, PropertyList, FileManager} from '@ticlo/editor';
import {TicloCurrentFlowConsumer, TicloCurrentFlowContext} from '@ticlo/editor/component/LayoutContext.ts';
import {EditPolicyProvider} from '@ticlo/editor/component/EditPolicyContext.tsx';
import {BlockStagePane} from '@ticlo/editor/dock/block/BlockStagePane.tsx';
import {BlockStageTabButton} from '@ticlo/editor/dock/block/BlockStageTabButton.tsx';
import {FunctionSelect} from '@ticlo/editor/function-selector/FunctionSelect.tsx';
import {t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {RemoteStorage, StaticStorage} from '@ticlo/remote-storage';
import type {FileEntry, ProjectFiles} from '@ticlo/core/storage/FileAccess.ts';
import {requestCallbacks} from '@ticlo/editor/util/RequestCallbacks.ts';
import {DockLayout, type LayoutBase, type TabDefinitions, type TabData} from 'rc-dock';
import {sideColumns, stageGroup, toolGroup, createLayoutActions, stageReadonly} from './AppLayout.ts';
import {antdLocales, initAppI18n} from './AppI18n.tsx';
import {AppHeader, AppTheme, appHeaderHeight} from './AppHeader.tsx';
import {FileMenuHeader} from './FileMenu.tsx';
import {createRoot} from 'react-dom/client';
import i18next from 'i18next';
import '@ticlo/react';
import '@ticlo/chart';
import '@ticlo/chart/style/index.css';
import '@ticlo/test';
import './sample-blocks.ts';
import {StageConnection, StageConnectionContext, connectStageTab} from './StageConnection.tsx';
import {designerData} from './sample-data/designer.ts';
import {EditorWindows} from './EditorWindows.ts';
import {fileFlowPath, pageFlowPath} from './flow-path.ts';
import {reloadDiscardedFileFlow, resetProjectFlows, unloadDeletedFileFlows} from './file-flow-lifecycle.ts';
import {useNamespaceSelection} from './useNamespaceSelection.ts';
import type {NamespaceSelectionOptions} from '@ticlo/editor/namespace/NamespaceSelectDialog.tsx';
import {createLibraryAutoLoad} from './library-auto-load.ts';
import {initialUrlParams} from './url-state.ts';

const FileVersionContext = React.createContext(0);
const strictMode = initialUrlParams().has('strictMode');

function DesignerProperties({conn}: {conn: ClientConnection}) {
  const {activeStage: stage} = useContext(TicloCurrentFlowContext);
  return (
    <PropertyList
      conn={stage?.conn ?? conn}
      paths={stage?.selection.paths ?? []}
      funcLib={stage?.funcLib ?? stage?.basePath}
      style={{width: '100%', height: '100%', padding: 8}}
    />
  );
}

function openDesignerFlow(
  path: string,
  flow: Flow,
  conn: ClientConnection,
  storage: ProjectFiles,
  layout: DesignerLayoutContext
) {
  const onSave = stageReadonly(storage, path)
    ? null
    : () => {
        conn.applyFlowChange(path, undefined, requestCallbacks);
      };
  if (flow.getValue('#is') === 'flow:main' || flow.getValue('#is') === 'flow:worker') {
    layout.designFlow?.(path, onSave);
  } else {
    layout.editFlow?.(path, onSave);
  }
}

function DesignerFiles({
  root,
  conn,
  storage,
  project,
  layout,
  onFilesDeleted,
  onFileDiscarded,
  onProjectReset,
}: {
  root: Root;
  conn: ClientConnection;
  storage: ProjectFiles;
  project: string;
  layout: DesignerLayoutContext;
  onFilesDeleted: (paths: string[]) => Promise<void>;
  onFileDiscarded: (path: string) => Promise<void>;
  onProjectReset: () => Promise<void>;
}) {
  const version = useContext(FileVersionContext);
  const open = async (entry: FileEntry) => {
    const target = fileFlowPath(project, entry.path);
    if (!target) throw new Error('This file is not a loadable flow.');
    const flow = await root.loadFlow(target.ref);
    openDesignerFlow(target.path, flow, conn, storage, layout);
  };
  return (
    <FileManager
      key={version}
      storage={storage}
      project={project}
      onOpen={open}
      onFilesDeleted={onFilesDeleted}
      onFileDiscarded={onFileDiscarded}
      onProjectReset={onProjectReset}
    />
  );
}

function DesignerHeader({
  language,
  onLanguageChange,
  openEditor,
  root,
  conn,
  files,
  onFilesChange,
  onNamespaceChange,
  onNamespaceUnload,
  onSetDefaultNamespace,
}: {
  language: string;
  onLanguageChange: (language: string) => void;
  openEditor: (path?: string) => void;
  root: Root;
  conn: ClientConnection;
  files?: {storage: ProjectFiles; project: string};
  onFilesChange: () => void;
  onNamespaceChange: (name: string, options: NamespaceSelectionOptions) => Promise<void>;
  onNamespaceUnload: (name: string) => Promise<void>;
  onSetDefaultNamespace: (name: string) => Promise<void>;
}) {
  const layout = useContext(DesignerLayoutContextType);
  const {currentPath} = useContext(TicloCurrentFlowContext);
  const {designMode, setDesignMode} = layout;
  const viewItems = [
    {
      key: 'open-editor',
      icon: <EditOutlined />,
      label: t('Open Editor'),
      onClick: () => openEditor(currentPath ?? undefined),
    },
  ];
  const content = (
    <Switch checked={designMode} onChange={setDesignMode} checkedChildren="Design" unCheckedChildren="Preview" />
  );
  if (files) {
    return (
      <FileMenuHeader
        language={language}
        onLanguageChange={onLanguageChange}
        root={root}
        conn={conn}
        files={files}
        newPage
        onChange={onFilesChange}
        onNamespaceChange={onNamespaceChange}
        onNamespaceUnload={onNamespaceUnload}
        onSetDefaultNamespace={onSetDefaultNamespace}
        onOpen={(path, flow) => openDesignerFlow(path, flow, conn, files.storage, layout)}
        viewItems={viewItems}
      >
        {content}
      </FileMenuHeader>
    );
  }
  return (
    <AppHeader language={language} onLanguageChange={onLanguageChange} viewItems={viewItems}>
      {content}
    </AppHeader>
  );
}

const layoutGroups = {
  main: stageGroup,
  tool: toolGroup,
};

interface Props {
  root: Root;
  conn: ClientConnection;
  initialFlow?: string;
  files?: {storage: ProjectFiles; project: string};
  onNamespaceChange: (name: string, options: NamespaceSelectionOptions) => Promise<void>;
  onNamespaceUnload: (name: string) => Promise<void>;
  onSetDefaultNamespace: (name: string) => Promise<void>;
}

interface State {
  modal?: React.ReactElement;
  fileVersion: number;
}

class App extends React.PureComponent<Props, State> {
  state: State = {fileVersion: 0};
  libraryAutoLoad = createLibraryAutoLoad(this.props.root);
  get conn() {
    return this.props.conn;
  }
  defaultDockLayout: LayoutBase;
  tabs: TabDefinitions;
  constructor(props: Props) {
    super(props);
    const {conn, initialFlow} = props;
    const initialTab = initialFlow ? this.createDesignerTab(initialFlow) : undefined;
    this.tabs = {
      Navigation: {
        group: 'tool',
        title: t('Navigation'),
        cached: true,
        content: (
          <DesignerNavigationTree
            conn={conn}
            basePaths={['']}
            hideRoot={true}
            onSelect={this.onSelect}
            showMenu={true}
            libraryAutoLoad={this.libraryAutoLoad}
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
      Properties: {
        group: 'tool',
        title: t('Properties'),
        cached: true,
        content: <DesignerProperties conn={conn} />,
      },
      Outline: {
        group: 'tool',
        title: 'Outline',
        cached: true,
        content: <DesignerNodeTree />,
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
            <DesignerFiles
              root={props.root}
              conn={conn}
              {...props.files}
              layout={this.ticloContext}
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
                tabs: [{id: 'Functions'}],
              },
            ],
          },
          {
            size: 800,
            tabs: initialTab ? [initialTab] : [],
            id: 'main',
            panelLock: {panelStyle: 'main'},
          },
          {
            id: 'right',
            mode: 'vertical',
            size: 280,
            children: [
              {
                size: 400,
                tabs: [{id: 'Properties'}],
              },
              {
                size: 300,
                tabs: [{id: 'Outline'}],
              },
            ],
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
  onFilesChange = () => this.setState(({fileVersion}) => ({fileVersion: fileVersion + 1}));
  onFilesDeleted = (paths: string[]) =>
    unloadDeletedFileFlows(this.props.root, this.layout, this.props.files.project, paths);
  onFileDiscarded = (path: string) => reloadDiscardedFileFlow(this.props.root, this.props.files.project, path);
  onProjectReset = () =>
    resetProjectFlows(this.props.root, this.layout, this.props.files.storage, this.props.files.project);

  layout: DockLayout;
  getLayout = (layout: DockLayout) => {
    this.layout = layout;
  };

  /// implements TicloLayoutContext
  ticloContext: DesignerLayoutContext = {
    language: this.lng,
    editFlow: (path: string, onSave: () => void) => {
      if (!this.layout.updateTab(`blockEditor:${path}`, null, true)) {
        this.layout.dockMove(
          connectStageTab(
            BlockStagePane.createDockTab(path, this.conn, this.onSelect, onSave, {
              defaultShowPropertyList: false,
            }),
            stageReadonly(this.props.files?.storage, path)
          ),
          'main',
          'middle'
        );
      }
    },
    designFlow: (path: string, onSave: () => void) => {
      if (!this.layout.updateTab(`designer:${path}`, null, true)) {
        this.layout.dockMove(this.createDesignerTab(path, onSave), 'main', 'middle');
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

  createDesignerTab(path: string, onSave?: () => void): TabData {
    const readonly = stageReadonly(this.props.files?.storage, path);
    const id = `designer:${path}`;
    const save =
      onSave ??
      (() => {
        this.conn.applyFlowChange(path, undefined, requestCallbacks);
      });
    return {
      id,
      title: (
        <StageConnection readonly={readonly}>
          <BlockStageTabButton conn={this.conn} id={id} path={path} title={path} onSave={save} />
        </StageConnection>
      ),
      group: 'main',
      closable: false,
      content: (
        <StageConnection readonly={readonly}>
          <DesignerStage root={this.props.root} conn={this.conn} basePath={path} stageId={id} onSave={save} />
        </StageConnection>
      ),
    };
  }

  editorWindows = new EditorWindows(this.props.root, {
    fileHost: initialUrlParams().get('host') || undefined,
    staticStorage: !initialUrlParams().get('host'),
    project: this.props.files.project,
  });
  openEditor = (path?: string) =>
    this.editorWindows.open(path && this.props.root.queryValue(path) instanceof Flow ? path : undefined);
  closeEditors = () => this.editorWindows.close();
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
      <AntdApp style={{height: '100%', backgroundColor: 'var(--ant-color-bg-layout)'}}>
        <StageConnectionContext.Provider value={conn}>
          <EditPolicyProvider conn={conn}>
            <FileVersionContext.Provider value={this.state.fileVersion}>
              <DesignerApp value={this.ticloContext}>
                <DesignerHeader
                  language={this.lng}
                  onLanguageChange={this.switchLan}
                  openEditor={this.openEditor}
                  root={this.props.root}
                  conn={conn}
                  files={this.props.files}
                  onFilesChange={this.onFilesChange}
                  onNamespaceChange={this.props.onNamespaceChange}
                  onNamespaceUnload={this.props.onNamespaceUnload}
                  onSetDefaultNamespace={this.props.onSetDefaultNamespace}
                />
                <DockLayout
                  defaultLayout={this.defaultDockLayout}
                  tabs={this.tabs}
                  sideColumns={sideColumns}
                  ref={this.getLayout}
                  groups={layoutGroups}
                  style={{position: 'absolute', left: 0, top: appHeaderHeight + 4, right: 0, bottom: 4}}
                />
                {modal}
              </DesignerApp>
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

function DesignerWorkspace({
  root,
  conn,
  initialFlow,
  files,
}: {
  root: Root;
  conn: ClientConnection;
  initialFlow?: string;
  files: {storage: ProjectFiles; project: string};
}) {
  const selection = useNamespaceSelection(root, conn, files.project, initialFlow);
  return (
    <App
      key={selection.project}
      root={root}
      conn={conn}
      initialFlow={selection.initialFlow}
      files={{...files, project: selection.project}}
      onNamespaceChange={selection.selectNamespace}
      onNamespaceUnload={selection.unloadNamespace}
      onSetDefaultNamespace={selection.setDefaultNamespace}
    />
  );
}

(async () => {
  addConsoleLogger();
  await initEditor();

  await initAppI18n();

  const params = initialUrlParams();
  const host = params.get('host');
  const selected = pageFlowPath(params);
  const root = Root.instance;
  let initialFlow: string;
  let files: Props['files'];
  if (host) {
    const storage = new RemoteStorage({baseURL: host});
    const project = selected?.ref.namespace ?? params.get('project') ?? '#root';
    files = {storage, project};
    await root.setStorage(storage);
    await root.start(
      selected
        ? {[project]: {flows: [selected.ref.name]}}
        : params.has('flow')
          ? {[project]: {flows: params.getAll('flow')}}
          : params.has('project')
            ? {[project]: {}}
            : undefined
    );
    if (selected) initialFlow = selected.path;
    else {
      const firstFlow = (await root.listFlows(project)).find(({state}) => state !== 'unloaded');
      if (firstFlow) initialFlow = project === '#root' ? firstFlow.name : `+${project}.${firstFlow.name}`;
    }
  } else {
    const storage = new StaticStorage(new URL('./storage', location.href).href);
    const project = selected?.ref.namespace ?? params.get('project') ?? 'local';
    files = {storage, project};
    await root.setStorage(storage);
    if (selected) {
      const sample =
        selected.path === '+local.designer-example' &&
        !(await root.listFlows('local')).some(({name}) => name === 'designer-example');
      await root.start({[selected.ref.namespace]: {flows: sample ? [] : [selected.ref.name]}});
      if (sample) root.addFlow(selected.path, designerData);
      initialFlow = selected.path;
    } else {
      await root.start({[project]: params.has('project') ? {} : {flows: ['**']}});
      if (project === 'local' && !params.has('project')) {
        if (!(root.queryValue('+local.designer-example') instanceof Flow)) {
          root.addFlow('+local.designer-example', designerData);
        }
        initialFlow = params.get('flow') || '+local.designer-example';
      }
    }
  }

  const [server, client] = makeLocalConnection(root, true, undefined, false);
  createRoot(document.getElementById('app')).render(
    <DesignerWorkspace root={root} conn={client} initialFlow={initialFlow} files={files} />
  );
})().catch((error) => {
  console.error(error);
  document.getElementById('app').textContent = `Failed to load designer: ${error.message}`;
});

(window as any).Logger = Logger;
addConsoleLogger(Logger.TRACE_AND_ABOVE);
