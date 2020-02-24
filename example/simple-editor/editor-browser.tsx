import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {FunctionDesc, PropDesc, ClientConnection, Logger, PropDispatcher} from '../../src/core/editor';
import {initEditor, PropertyList, BlockStage, NodeTree} from '../../src/editor';
import {DragDropDiv, DragState, DockLayout, DockContextType} from 'rc-dock';
import {FunctionTree} from '../../src/editor/function-selector/FunctionTree';

import './sample-blocks';
import {WorkerFunction} from '../../src/core/worker/WorkerFunction';
import {BlockStagePane} from '../../src/editor/dock/block/BlockStagePane';
import {TicloLayoutContext, TicloLayoutContextType} from '../../src/editor/component/LayoutContext';
import {PropertyListPane} from '../../src/editor/dock/property/PropertyListPane';
import {WsBrowserConnection} from '../../src/html/connect/WsBrowserConnection';
import {FrameClientConnection} from '../../src/html/connect/FrameClientConnection';
import {NodeTreePane} from '../../src/editor/dock/node-tree/NodeTreePane';
import {TextEditorPane} from '../../src/editor/dock/text-editor/TextEditorPane';
import {FunctionSelect} from '../../src/editor/function-selector/FunctionSelector';

const layoutGroups = {
  blockStage: {
    animated: false,
    floatable: true
  }
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

  /// implements TicloLayoutContext
  editJob(path: string, onSave: () => void) {
    this.layout.dockMove(this.createBlockEditorTab(path, onSave), this.layout.find('main'), 'middle');
  }
  editProperty(paths: string[], propDesc: PropDesc, defaultValue?: any, mime?: string, readonly?: boolean): void {
    let {conn} = this.props;
    if (!mime) {
      if (propDesc.mime) {
        mime = propDesc.mime;
      } else if (propDesc.type === 'object' || propDesc.type === 'array') {
        mime = 'application/json';
      }
    }
    TextEditorPane.openFloatPanel(this.layout, conn, paths, defaultValue, mime, readonly);
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
                id: 'Functions',
                title: 'Functions',
                cached: true,
                cacheContext: TicloLayoutContextType,
                content: <FunctionSelect conn={conn}/>
              },
              {
                id: 'Properties',
                title: 'Properties',
                cached: true,
                cacheContext: TicloLayoutContextType,
                content: <PropertyListPane conn={conn} />
              },
              {
                id: 'Navigation',
                title: 'Navigation',
                cached: true,
                cacheContext: TicloLayoutContextType,
                content: <NodeTreePane conn={conn} basePaths={['']} hideRoot={true} onSelect={this.onSelect} />
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
