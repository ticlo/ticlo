import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {FunctionDesc} from '../../src/core/client';
import {initEditor, PropertyList, BlockStage, NodeTree} from '../../src/editor';
import {DragDropDiv, DragState, DockLayout, DockContextType} from 'rc-dock';
import {ClientConnection} from '../../src/core/connect/ClientConnection';
import {Types} from '../../src/core/block/Type';
import {TypeTree} from '../../src/editor/type-selector/TypeTree';

import './sample-blocks';
import {Logger} from '../../src/core/util/Logger';
import {WorkerFunction} from '../../src/core/worker/WorkerFunction';
import {BlockStagePanel} from '../../src/panel/block/BlockStagePanel';
import {TicloLayoutContext, TicloLayoutContextType} from '../../src/editor/component/LayoutContext';
import {Dispatcher, ValueDispatcher} from '../../src/core/block/Dispatcher';
import {PropertyListPanel} from '../../src/panel/property/PropertyListPanel';
import {ObjectTreePanel} from '../../src/panel/object-tree/ObjectTreePanel';
import {WsBrowserConnection} from '../../src/browser/connect/WsBrowserConnection';
import {FrameClientConnection} from '../../src/browser/connect/FrameClientConnection';

const layoutGroups = {
  blockStage: {
    animated: false,
    floatable: true
  },
  objectTree: ObjectTreePanel.dockGroup
};

interface Props {
  conn: ClientConnection;
}

interface State {}

WorkerFunction.registerType({'#is': ''}, {name: 'class1'}, 'WorkerEditor');

class App extends React.PureComponent<Props, State> implements TicloLayoutContext {
  constructor(props: Props) {
    super(props);
  }

  forceUpdateLambda = () => this.forceUpdate();
  forceUpdateImmediate = () => {
    this.props.conn.callImmediate(this.forceUpdateLambda);
  };

  layout: DockLayout;
  getLayout = (layout: DockLayout) => {
    this.layout = layout;
  };

  selectedKeys: Dispatcher<string[]> = new ValueDispatcher();

  onSelect = (keys: string[], handled: boolean) => {
    if (!handled) {
      this.selectedKeys.updateValue(keys);
    }
  };

  createBlockEditorTab(path: string, onSave?: () => void) {
    let {conn} = this.props;
    return BlockStagePanel.createDockTab(path, conn, this.onSelect, onSave);
  }

  /// implements TicloLayoutContext
  editJob(path: string, onSave: () => void) {
    this.layout.dockMove(this.createBlockEditorTab(path, onSave), this.layout.find('main'), 'middle');
  }
  showObjectTree(path: string, value: any, element: HTMLElement, source: any) {
    let {conn} = this.props;
    ObjectTreePanel.openFloatPanel(this.layout, path, conn, value, element, source, 18, 0);
  }
  closeObjectTree(path: string, source: any) {
    ObjectTreePanel.closeFloatPanel(this.layout, path, source);
  }

  onDragBlock = (e: DragState) => {
    let {conn} = this.props;
    e.setData(
      {
        block: {
          '#is': 'add',
          '1': 4,
          '@b-p': ['0', '1', 'output', '@b-p', '#is']
        }
      },
      conn
    );
    e.startDrag();
  };
  onDragSlider = (e: DragState) => {
    let {conn} = this.props;
    e.setData(
      {
        block: {
          '#is': 'slider-view',
          '@b-p': ['value']
        }
      },
      conn
    );
    e.startDrag();
  };

  render() {
    let {conn} = this.props;

    let layout: any = {
      dockbox: {
        mode: 'horizontal',
        children: [
          {
            size: 200,
            tabs: [
              {
                id: 'NavTree',
                title: 'NavTree',
                cached: true,
                cacheContext: TicloLayoutContextType,
                content: (
                  <NodeTree
                    conn={conn}
                    basePaths={['']}
                    hideRoot={true}
                    style={{width: '100%', height: '100%', padding: '8px'}}
                  />
                )
              },
              {
                id: 'PropertyList',
                title: 'PropertyList',
                cached: true,
                cacheContext: TicloLayoutContextType,
                content: <PropertyListPanel conn={conn} />
              },
              {
                id: 'Types',
                title: 'Types',
                cached: true,
                content: (
                  <TypeTree
                    conn={conn}
                    style={{height: '100%'}}
                    onTypeClick={(name: string, desc: FunctionDesc, data: any) => {
                      console.log(name, desc, data);
                    }}
                  />
                )
              }
            ]
          },
          {
            size: 800,
            tabs: [this.createBlockEditorTab('example')],
            id: 'main',
            panelLock: {panelStyle: 'main'}
          }
        ]
      }
    };
    return (
      <TicloLayoutContextType.Provider value={this}>
        <DockLayout
          defaultLayout={layout}
          ref={this.getLayout}
          groups={layoutGroups}
          style={{position: 'absolute', left: 10, top: 10, right: 10, bottom: 10}}
        />
      </TicloLayoutContextType.Provider>
    );
  }
}

(async () => {
  await initEditor();
  let client = window.opener
    ? new FrameClientConnection(window.opener) // used by server-window.html
    : new WsBrowserConnection(`ws://127.0.0.1:8010/ticlo`); // used by express server

  ReactDOM.render(<App conn={client} />, document.getElementById('app'));
})();

(window as any).Logger = Logger;
