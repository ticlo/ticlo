import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {Menu, Icon, Dropdown, Button, Card} from 'antd';
import {Block, Root, ClientConnection} from "../../src/core";
import {makeLocalConnection} from "../../src/core/connect/LocalConnection";
import {TIcon} from "../../src/editor/icon/Icon";
import {sampleData} from "./sample-data";
import {initEditor, PropertyList, BlockStage, NodeTree} from "../../src/editor";
import {DragDropDiv, DragState, DockLayout, DockContextType} from "rc-dock";
import {TabBase, TabData} from "rc-dock/lib";

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

  onSelect = (keys: string[]) => {
    this.setState({'selectedKeys': keys});
  };

  onDragBlock = (e: DragState) => {
    let {conn} = this.props;
    e.setData({
      block: {
        '#is': 'add',
        '1': 4,
        '@b-xyw': [100, 100, 150],
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
        '@b-xyw': [100, 100, 150],
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
                  <Context.Consumer>
                    {
                      (keys) =>
                        <PropertyList conn={conn} keys={keys}
                                      style={{width: '100%', height: '100%', padding: '8px'}}/>

                    }
                  </Context.Consumer>

                )
              }, {
                id: 'NavTree', title: 'NavTree', cached: true, content: (
                  <NodeTree conn={conn} basePath="example" style={{width: '100%', height: '100%', padding: '8px'}}/>
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
    console.log(selectedKeys);
    return (
      <Context.Provider value={selectedKeys}>
        <DockLayout defaultLayout={layout}
                    style={{position: 'absolute', left: 10, top: 10, right: 10, bottom: 10}}/>
      </Context.Provider>
      /*      <div style={{height: '100%'}}>

              <div>
                <NodeTree conn={conn} basePath="example" style={{width: '300px', height: '600px'}}/>
                <BlockStage conn={conn} basePath="example" onSelect={this.onSelect}
                            style={{
                              width: '800px',
                              height: '800px',
                              left: '300px',
                              top: '0',
                              position: 'absolute',
                              // opacity: 0.1
                            }}/>
                <Card size='small'
                      style={{width: '350px', height: '800px', left: '1120px', top: '10px', position: 'absolute'}}>
                  <PropertyList conn={conn} keys={selectedKeys}
                  />
                </Card>

                <DragDropDiv onDragStartT={this.onDragBlock}> Drag Add </DragDropDiv>
                <DragDropDiv onDragStartT={this.onDragSlider}> Drag Slider </DragDropDiv>


              </div>
            </div>*/
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
