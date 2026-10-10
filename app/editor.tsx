import './styles.ts';
import * as React from 'react';
import {ConfigProvider, Switch, type RadioChangeEvent} from 'antd';
import {Block, DataMap, decode, encodeSorted, FunctionDesc, Flow, Root, addConsoleLogger} from '@ticlo/core';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {data} from './sample-data/data.ts';
import reactData from './sample-data/react.ts';
import {initEditor, PropertyList, BlockStage, NodeTree} from '@ticlo/editor';
import {DockLayout, type LayoutBase, type TabDefinitions} from 'rc-dock';
import {leftSideColumns, stageGroup, createLayoutActions} from './AppLayout.ts';
import {antdLocales, initAppI18n, LanguageSettings} from './AppI18n.tsx';
import {ClientConnection} from '@ticlo/core/connect/ClientConnection.ts';
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
import {theme} from '@ticlo/editor/style/theme.ts';
import {FunctionSelect} from '@ticlo/editor/function-selector/FunctionSelect.tsx';

import i18next from 'i18next';

import {LocalizedLabel, t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {FlowTestCase} from '@ticlo/test/FlowTestCase.ts';
import {createRoot} from 'react-dom/client';
import {MixedBrowserConnection} from '@ticlo/html/connect/MixedBrowserConnection.ts';
import {Namespace} from '@ticlo/core/block/Namespace.ts';

const layoutGroups = {
  blockStage: stageGroup,
};

interface Props {
  conn: ClientConnection;
  initialFlow?: string;
}

WorkerFunctionGen.registerType({'#is': ''}, {name: 'class1'}, '+WorkerEditor');

class App extends React.PureComponent<Props> {
  defaultDockLayout: LayoutBase;
  tabs: TabDefinitions;
  constructor(props: Props) {
    super(props);
    const {conn, initialFlow} = props;
    const initialTab = initialFlow
      ? this.createBlockEditorTab(initialFlow, () => conn.applyFlowChange(initialFlow))
      : undefined;
    this.tabs = {
      'Navigation': {
        title: t('Navigation'),
        cached: true,
        content: <NodeTreePane conn={conn} basePaths={['']} hideRoot={true} onSelect={this.onSelect} showMenu={true} />,
      },
      'Test Language': {
        title: 'Test Language',
        content: (
          <div style={{margin: 12}}>
            <LanguageSettings onChange={this.switchLan} />
          </div>
        ),
      },
      'Functions': {
        title: t('Functions'),
        cached: true,
        content: (
          <TicloCurrentFlowConsumer>
            {({currentPath}) => (
              <FunctionSelect conn={conn} funcLib={currentPath ? `${currentPath}.#lib` : undefined} />
            )}
          </TicloCurrentFlowConsumer>
        ),
      },
      'Properties': {
        title: t('Properties'),
        cached: true,
        content: <PropertyListPane conn={conn} />,
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
                tabs: [{id: 'Navigation'}, {id: 'Test Language'}],
              },
              {
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
      this.layout.dockMove(this.createBlockEditorTab(path, onSave), 'main', 'middle');
    },

    ...createLayoutActions(
      () => this.layout,
      () => this.props.conn
    ),
    getSelectedPaths: () => this.selectedPaths,
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
    return (
      <ConfigProvider locale={this.lngConfig} theme={theme}>
        <TicloApp value={this.ticloContext}>
          <DockLayout
            defaultLayout={this.defaultDockLayout}
            tabs={this.tabs}
            sideColumns={leftSideColumns}
            ref={this.getLayout}
            groups={layoutGroups}
            style={{position: 'absolute', left: 0, top: 10, right: 10, bottom: 10}}
          />
        </TicloApp>
      </ConfigProvider>
    );
  }
}

(async () => {
  await initEditor();
  await initAppI18n();

  const client = window.opener
    ? new FrameClientConnection(window.opener) // used by server-window.html
    : new MixedBrowserConnection(`http://127.0.0.1:8010/ticlo`); // used by ticlo-server
  const initialFlow = new URLSearchParams(location.search).get('flow') || undefined;
  createRoot(document.getElementById('app')).render(<App conn={client} initialFlow={initialFlow} />);
})();

(window as any).Logger = Logger;
// addConsoleLogger(Logger.TRACE_AND_ABOVE);
