import './styles.ts';
import '@ticlo/designer/style/index.css';
import React, {StrictMode, useContext} from 'react';
import {App as AntdApp, Button, Checkbox, type RadioChangeEvent} from 'antd';
import {Root, Flow, Logger, PropDispatcher, addConsoleLogger} from '@ticlo/core';
import {ClientConnection} from '@ticlo/core/connect/ClientConnection.ts';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {
  DesignerApp,
  DesignerLayoutContextType,
  DesignerNavigationTree,
  DesignerNodeTree,
  DesignerStage,
  useActiveDesignerStage,
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
import {AppTheme, AppToolBox} from './AppToolBox.tsx';
import {createRoot} from 'react-dom/client';
import i18next from 'i18next';
import '@ticlo/react';
import '@ticlo/test';
import './sample-blocks.ts';
import {PlaygroundConnection, PlaygroundConnectionContext, connectStageTab} from './PlaygroundConnection.tsx';
import {designerData} from './sample-data/designer.ts';
import {EditorWindows} from './EditorWindows.ts';
import {fileFlowPath, pageFlowPath} from './flow-path.ts';

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

function DesignerFiles({
  root,
  conn,
  storage,
  project,
}: {
  root: Root;
  conn: ClientConnection;
  storage: ProjectFiles;
  project: string;
}) {
  const {designFlow, editFlow} = useContext(DesignerLayoutContextType);
  const open = async (entry: FileEntry) => {
    const target = fileFlowPath(project, entry.path);
    if (!target) throw new Error('This file is not a loadable flow.');
    const flow = await root.loadFlow(target.ref);
    const onSave = stageReadonly(storage, target.path)
      ? null
      : () => {
          conn.applyFlowChange(target.path, undefined, requestCallbacks);
        };
    if (flow.getValue('#is') === 'flow:main' || flow.getValue('#is') === 'flow:worker') {
      designFlow?.(target.path, onSave);
    } else {
      editFlow?.(target.path, onSave);
    }
  };
  return <FileManager storage={storage} project={project} onOpen={open} />;
}

function ToolBox({
  switchLan,
  openEditor,
}: {
  switchLan: (e?: RadioChangeEvent) => void;
  openEditor: (path: string) => void;
}) {
  const {designMode, setDesignMode} = useContext(DesignerLayoutContextType);
  return (
    <AppToolBox switchLan={switchLan}>
      <OpenEditorButton openEditor={openEditor} />
      <Checkbox checked={designMode} onChange={(e) => setDesignMode?.(e.target.checked)}>
        Design mode
      </Checkbox>
    </AppToolBox>
  );
}

function OpenEditorButton({openEditor}: {openEditor: (path: string) => void}) {
  const stage = useActiveDesignerStage();
  return (
    <Button
      size="small"
      style={{position: 'absolute', top: 8, right: 8, zIndex: 1}}
      disabled={!stage?.flow}
      onClick={() => openEditor(stage.basePath)}
    >
      Open Editor
    </Button>
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
}

interface State {
  modal?: React.ReactElement;
}

class App extends React.PureComponent<Props, State> {
  state: State = {};
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
      ToolBox: {
        group: 'tool',
        title: 'ToolBox',
        minHeight: 210,
        cached: true,
        content: <ToolBox switchLan={this.switchLan} openEditor={this.openEditor} />,
      },
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
          content: <DesignerFiles root={props.root} conn={conn} {...props.files} />,
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
                tabs: [{id: 'Navigation'}, ...(props.files ? [{id: 'Files'}] : [])],
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
        const flow = this.props.root.queryValue(path);
        if (flow instanceof Flow) flow.applyChange();
      });
    return {
      id,
      title: (
        <PlaygroundConnection readonly={readonly}>
          <BlockStageTabButton conn={this.conn} id={id} path={path} title={path} onSave={save} />
        </PlaygroundConnection>
      ),
      group: 'main',
      closable: false,
      content: (
        <PlaygroundConnection readonly={readonly}>
          <DesignerStage root={this.props.root} conn={this.conn} basePath={path} stageId={id} onSave={save} />
        </PlaygroundConnection>
      ),
    };
  }

  editorWindows = new EditorWindows(this.props.root);
  openEditor = (path: string) => this.editorWindows.open(path);
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
        <PlaygroundConnectionContext.Provider value={conn}>
          <EditPolicyProvider conn={conn}>
            <DesignerApp value={this.ticloContext}>
              <DockLayout
                defaultLayout={this.defaultDockLayout}
                tabs={this.tabs}
                sideColumns={sideColumns}
                ref={this.getLayout}
                groups={layoutGroups}
                style={{position: 'absolute', left: 0, top: 4, right: 0, bottom: 4}}
              />
              {modal}
            </DesignerApp>
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
        : params.has('project') || params.has('flow')
          ? {[project]: {flows: params.getAll('flow')}}
          : undefined
    );
    if (selected) initialFlow = selected.path;
    else {
      const firstFlow = (await root.listFlows(project)).find(({state}) => state !== 'unloaded');
      if (firstFlow) initialFlow = project === '#root' ? firstFlow.name : `+${project}.${firstFlow.name}`;
    }
  } else {
    const storage = new StaticStorage(new URL('./storage', location.href).href);
    files = {storage, project: selected?.ref.namespace ?? 'local'};
    await root.setStorage(storage);
    if (selected) {
      const sample =
        selected.path === '+local.designer-example' &&
        !(await root.listFlows('local')).some(({name}) => name === 'designer-example');
      await root.start({[selected.ref.namespace]: {flows: sample ? [] : [selected.ref.name]}});
      if (sample) root.addFlow(selected.path, designerData);
      initialFlow = selected.path;
    } else {
      await root.start({local: {flows: ['**']}});
      if (!(root.queryValue('+local.designer-example') instanceof Flow)) {
        root.addFlow('+local.designer-example', designerData);
      }
      initialFlow = params.get('flow') || '+local.designer-example';
    }
  }

  const [server, client] = makeLocalConnection(root, true, undefined, false);
  createRoot(document.getElementById('app')).render(
    <App root={root} conn={client} initialFlow={initialFlow} files={files} />
  );
})().catch((error) => {
  console.error(error);
  document.getElementById('app').textContent = `Failed to load designer: ${error.message}`;
});

(window as any).Logger = Logger;
addConsoleLogger(Logger.TRACE_AND_ABOVE);
