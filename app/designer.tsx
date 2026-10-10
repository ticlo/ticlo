import './styles.ts';
import '@ticlo/designer/style/index.css';
import React, {StrictMode, useContext, useEffect, useRef} from 'react';
import {Button, Checkbox, ConfigProvider, type RadioChangeEvent} from 'antd';
import {ReloadOutlined, UndoOutlined} from '@ant-design/icons';
import {Root, Flow, Logger, PropDispatcher, addConsoleLogger} from '@ticlo/core';
import {ClientConnection} from '@ticlo/core/connect/ClientConnection.ts';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {
  DesignerApp,
  DesignerLayoutContextType,
  DesignerNodeTree,
  DesignerStage,
  useActiveDesignerStage,
} from '@ticlo/designer';
import {initEditor, PropertyList} from '@ticlo/editor';
import {
  TicloCurrentFlowConsumer,
  TicloCurrentFlowContext,
  type TicloLayoutContext,
} from '@ticlo/editor/component/LayoutContext.ts';
import {EditPolicyProvider} from '@ticlo/editor/component/EditPolicyContext.tsx';
import {NodeTreePane} from '@ticlo/editor/dock/node-tree/NodeTreePane.tsx';
import {BlockStageTabButton} from '@ticlo/editor/dock/block/BlockStageTabButton.tsx';
import {FunctionSelect} from '@ticlo/editor/function-selector/FunctionSelect.tsx';
import {theme} from '@ticlo/editor/style/theme.ts';
import {t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {TooltipIconButton} from '@ticlo/editor/component/TooltipIconButton.tsx';
import {FrameServerConnection} from '@ticlo/html';
import {IndexDbFlowStorage} from '@ticlo/html/storage/IndexDbStorage.ts';
import {FileServerFlowStorage, TicloFileClient} from '@ticlo/remote-storage';
import {DockLayout, type LayoutBase, type TabDefinitions, type PanelData, type TabData} from 'rc-dock';
import {sideColumns, stageGroup, toolGroup, createLayoutActions} from './AppLayout.ts';
import {antdLocales, initAppI18n, LanguageSettings} from './AppI18n.tsx';
import {createRoot} from 'react-dom/client';
import i18next from 'i18next';
import '@ticlo/react';
import '@ticlo/test';
import './sample-blocks.ts';
import {PlaygroundConnection, PlaygroundConnectionContext} from './PlaygroundConnection.tsx';
import {designerData} from './sample-data/designer.ts';

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

function DesignerProperties({conn}: {conn: ClientConnection}) {
  const stage = useActiveDesignerStage();
  return (
    <PropertyList
      conn={stage?.conn ?? conn}
      paths={stage?.selection.paths ?? []}
      funcLib={stage?.basePath}
      style={{width: '100%', height: '100%', padding: 8}}
    />
  );
}

function ToolBox({
  switchLan,
  openEditor,
}: {
  switchLan: (e?: RadioChangeEvent) => void;
  openEditor: (path: string) => void;
}) {
  const {designMode, setDesignMode} = useContext(DesignerLayoutContextType);
  const stage = useActiveDesignerStage();
  return (
    <div style={{position: 'relative', padding: 8, height: '100%', overflow: 'auto', boxSizing: 'border-box'}}>
      <OpenEditorButton openEditor={openEditor} />
      <LanguageSettings onChange={switchLan} />
      <br />
      <Checkbox checked={designMode} onChange={(e) => setDesignMode?.(e.target.checked)}>
        Design mode
      </Checkbox>
      {stage?.flow && (
        <div key={stage.basePath} style={{display: 'flex', gap: 8, marginTop: 8}}>
          <TooltipIconButton
            conn={stage.conn}
            path={`${stage.basePath}.@has-undo`}
            tooltip={t('Undo')}
            icon={<UndoOutlined />}
            onClick={stage.undo}
          />
          <TooltipIconButton
            conn={stage.conn}
            path={`${stage.basePath}.@has-redo`}
            tooltip={t('Redo')}
            icon={<ReloadOutlined />}
            onClick={stage.redo}
          />
        </div>
      )}
    </div>
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
  designerStage: {
    ...stageGroup,
    panelExtra: (panel: PanelData) => <DesignerPanelFocus panel={panel} />,
  },
  tool: toolGroup,
};

interface Props {
  root: Root;
  conn: ClientConnection;
  initialFlow?: string;
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
        minHeight: 140,
        cached: true,
        content: <ToolBox switchLan={this.switchLan} openEditor={this.openEditor} />,
      },
      Navigation: {
        group: 'tool',
        title: t('Navigation'),
        cached: true,
        content: <NodeTreePane conn={conn} basePaths={['']} hideRoot={true} onSelect={this.onSelect} showMenu={true} />,
      },
      Functions: {
        group: 'tool',
        title: t('Functions'),
        cached: true,
        content: (
          <TicloCurrentFlowConsumer>
            {({currentPath}) => {
              return <FunctionSelect conn={conn} funcLib={currentPath ? `${currentPath}.#lib` : undefined} />;
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
                size: 140,
                tabs: [{id: 'ToolBox'}],
              },
              {
                size: 400,
                tabs: [{id: 'Navigation'}],
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
  ticloContext: TicloLayoutContext = {
    language: this.lng,
    editFlow: (path: string, onSave: () => void) => {
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
        <PlaygroundConnection>
          <BlockStageTabButton conn={this.conn} id={id} path={path} title={path} onSave={save} />
        </PlaygroundConnection>
      ),
      group: 'designerStage',
      closable: false,
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
    const editor = window.open(url.href, '_blank', 'popup,width=1200,height=800');
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
          <DesignerApp value={this.ticloContext}>
            <DockLayout
              defaultLayout={this.defaultDockLayout}
              tabs={this.tabs}
              sideColumns={sideColumns}
              ref={this.getLayout}
              groups={layoutGroups}
              style={{position: 'absolute', left: 0, top: 10, right: 0, bottom: 10}}
            />
            {modal}
          </DesignerApp>
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

  await initAppI18n();

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
