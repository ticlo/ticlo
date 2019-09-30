import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {Menu, Icon, Dropdown, Button, Card} from 'antd';
import {Block, FunctionDesc, Root} from '../../src/core/main';
import {makeLocalConnection} from '../../src/core/connect/LocalConnection';
import {TIcon} from '../../src/editor/icon/Icon';
import {sampleData} from './sample-data';
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
import {BlockStagePanel} from '../../src/panel/BlockStagePanel';
import {TicloLayoutContext, TicloLayoutContextType} from '../../src/editor/component/LayoutContext';

const layoutGroups = {
  blockStage: {
    animated: false,
    floatable: true
  }
};

interface Props {
  conn: ClientConnection;
}

interface State {
  selectedKeys: string[];
}

const SelectionContext = React.createContext<string[]>([]);
WorkerFunction.registerType({'#is': ''}, {name: 'class1'}, 'WorkerEditor');

class App extends React.PureComponent<Props, State> implements TicloLayoutContext {
  constructor(props: Props) {
    super(props);
    this.state = {selectedKeys: ['example.add']};
  }

  forceUpdateLambda = () => this.forceUpdate();
  forceUpdateImmediate = () => {
    this.props.conn.callImmediate(this.forceUpdateLambda);
  };

  layout: DockLayout;
  getLayout = (layout: DockLayout) => {
    this.layout = layout;
  };

  onSelect = (keys: string[]) => {
    this.setState({selectedKeys: keys});
  };

  count = 0;

  createBlockEditor(path: string, onSave?: () => void) {
    let {conn} = this.props;
    return {
      id: `blockEditor${this.count++}`,
      title: path,
      cached: false,
      group: 'blockStage',
      content: <BlockStagePanel conn={conn} basePath={path} onSelect={this.onSelect} onSave={onSave} />
    };
  }

  editJob(path: string, onSave: () => void) {
    this.layout.dockMove(this.createBlockEditor(path, onSave), this.layout.find('main'), 'middle');
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
    let {selectedKeys} = this.state;

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
                content: (
                  <PropertyList conn={conn} keys={['example.add']} style={{width: '100%', height: '100%', padding: '8px'}} />
                )
              },
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
            tabs: [this.createBlockEditor('example'), this.createBlockEditor('example')],
            id: 'main',
            panelLock: {panelStyle: 'main'}
          }
        ]
      }
    };
    return (
      <TicloLayoutContextType.Provider value={this}>
        <SelectionContext.Provider value={selectedKeys}>
          <DockLayout
            defaultLayout={layout}
            ref={this.getLayout}
            groups={layoutGroups}
            style={{position: 'absolute', left: 10, top: 10, right: 10, bottom: 10}}
          />
        </SelectionContext.Provider>
      </TicloLayoutContextType.Provider>
    );
  }
}

(async () => {
  await initEditor();
  let job = Root.instance.addJob('example');
  job.load(sampleData);

  // create some global blocks
  Root.instance._globalBlock.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalBlock.createBlock('^gSub').setValue('#is', 'subtract');

  let [server, client] = makeLocalConnection(Root.instance);

  ReactDOM.render(<App conn={client} />, document.getElementById('app'));
})();

(window as any).Logger = Logger;
