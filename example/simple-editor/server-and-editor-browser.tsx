import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {Block, FunctionDesc, PropDesc, Root} from '../../src/core/main';
import {makeLocalConnection} from '../../src/core/connect/LocalConnection';
import {TIcon} from '../../src/editor/icon/Icon';
import {data} from '../sample-data/data';
import {initEditor, PropertyList, BlockStage, NodeTree} from '../../src/editor';
import {DragDropDiv, DragState, DockLayout, DockContextType} from 'rc-dock';
import {ClientConnection} from '../../src/core/connect/ClientConnection';
import {TypeView} from '../../src/editor/type-selector/TypeView';
import {Types} from '../../src/core/block/Type';
import {TypeTreeRoot} from '../../src/editor/type-selector/TypeTreeItem';
import {TypeTree} from '../../src/editor/type-selector/TypeTree';

import './sample-blocks';
import {Logger} from '../../src/core/util/Logger';
import {NodeTreeItem} from '../../src/editor/node-tree/NodeRenderer';
import {WorkerFunction} from '../../src/core/worker/WorkerFunction';
import {BlockStageTab} from '../../src/dock/block/BlockStageTab';
import {TicloLayoutContext, TicloLayoutContextType} from '../../src/editor/component/LayoutContext';
import {PropDispatcher} from '../../src/core/block/Dispatcher';
import {PropertyListTab} from '../../src/dock/property/PropertyListTab';
import {ObjectTreeTab} from '../../src/dock/object-tree/ObjectTreeTab';
import {NodeTreeTab} from '../../src/dock/node-tree/NodeTreeTab';
import {TextEditorTab} from '../../src/dock/text-editor/TextEditorTab';
import {ClientConn} from '../../src/core/connect/ClientConn';

const layoutGroups = {
  blockStage: {
    animated: false,
    floatable: true
  },
  objectTree: ObjectTreeTab.dockGroup
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
    return BlockStageTab.createDockTab(path, conn, this.onSelect, onSave);
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
    TextEditorTab.openFloatPanel(this.layout, conn, paths, defaultValue, mime, readonly);
  }
  showObjectTree(path: string, value: any, element: HTMLElement, source: any) {
    let {conn} = this.props;
    ObjectTreeTab.openFloatPanel(this.layout, path, conn, value, element, source, 18, 0);
  }
  closeObjectTree(path: string, source: any) {
    ObjectTreeTab.closeFloatPanel(this.layout, path, source);
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
                id: 'PropertyList',
                title: 'PropertyList',
                cached: true,
                cacheContext: TicloLayoutContextType,
                content: <PropertyListTab conn={conn} />
              },
              {
                id: 'NavTree',
                title: 'NavTree',
                cached: true,
                cacheContext: TicloLayoutContextType,
                content: <NodeTreeTab conn={conn} basePaths={['']} hideRoot={true} onSelect={this.onSelect} />
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
            tabs: [this.createBlockEditorTab('example'), this.createBlockEditorTab('example')],
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
  let job = Root.instance.addJob('example');
  job.load(data);

  // create some global blocks
  Root.instance._globalBlock.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalBlock.createBlock('^gSub').setValue('#is', 'subtract');

  let [server, client] = makeLocalConnection(Root.instance);

  ReactDOM.render(<App conn={client} />, document.getElementById('app'));
})();

(window as any).Logger = Logger;
