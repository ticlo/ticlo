import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {Menu, Icon, Dropdown, Button, Card} from 'antd';
import {Block, FunctionDesc, Root} from "../../src/core/main";
import {makeLocalConnection} from "../../src/core/connect/LocalConnection";
import {TIcon} from "../../src/editor/icon/Icon";
import {sampleData} from "./sample-data";
import {initEditor, PropertyList, BlockStage, NodeTree} from "../../src/editor";
import {DragDropDiv, DragState, DockLayout, DockContextType} from "rc-dock";
import {ClientConnection} from "../../src/core/connect/ClientConnection";
import {TypeView} from "../../src/editor/type-selector/TypeView";
import {Types} from "../../src/core/block/Type";
import {TypeTreeRoot} from "../../src/editor/type-selector/TypeTreeItem";
import {TypeTree} from "../../src/editor/type-selector/TypeTree";


interface Props {
  conn: ClientConnection;
}

interface State {
  selectedKeys: string[];
}

const Context = React.createContext<string[]>([]);

class App extends React.PureComponent<Props, State> {

  constructor(props: Props) {
    super(props);
    this.state = {'selectedKeys': ['example.add']};
  }

  forceUpdateLambda = () => this.forceUpdate();
  forceUpdateImmediate = () => {
    this.props.conn.callImmediate(this.forceUpdateLambda);
  };

  onSelect = (keys: string[]) => {
    this.setState({'selectedKeys': keys});
  };

  onDragBlock = (e: DragState) => {
    let {conn} = this.props;
    e.setData({
      block: {
        '#is': 'add',
        '1': 4,
        '@b-p': ['0', '1', 'output', '@b-p', '#is'],
      }
    }, conn);
    e.startDrag();
  };
  onDragSlider = (e: DragState) => {
    let {conn} = this.props;
    e.setData({
      block: {
        '#is': 'slider-view',
        '@b-p': ['value'],
      }
    }, conn);
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
                id: 'PropertyList', title: 'PropertyList', cached: true, cacheContext: Context, content: (
                  <Context.Consumer>{(keys) =>
                    <PropertyList conn={conn} keys={keys}
                                  style={{width: '100%', height: '100%', padding: '8px'}}/>
                  }</Context.Consumer>
                )
              }, {
                id: 'NavTree', title: 'NavTree', cached: true, content: (
                  <NodeTree conn={conn} basePaths={[""]} hideRoot={true} style={{width: '100%', height: '100%', padding: '8px'}}/>
                )
              }, {
                id: 'Types', title: 'Types', cached: true, content: (
                  <TypeTree conn={conn} style={{height: '100%'}}
                            onTypeClick={(name: string, desc: FunctionDesc, data: any) => {
                              console.log(name, desc, data);
                            }}/>
                )
              }
            ],
          },
          {
            size: 800,
            tabs: [
              {
                id: 'Stage', title: 'Stage', cached: true, content: (
                  <BlockStage conn={conn} basePath="example" onSelect={this.onSelect}/>
                )
              }
            ],
          },
        ]
      },
    };
    return (
      <Context.Provider value={selectedKeys}>
        <DockLayout defaultLayout={layout}
                    style={{position: 'absolute', left: 10, top: 10, right: 10, bottom: 10}}/>
      </Context.Provider>
    );
  }
}

(async () => {
  await initEditor();
  let job = Root.instance.addJob('example');
  job.load(sampleData);

  let [server, client] = makeLocalConnection(Root.instance);

  ReactDOM.render(
    <App conn={client}/>,
    document.getElementById('app')
  );
})();
