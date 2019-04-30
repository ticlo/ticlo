import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {Menu, Icon, Dropdown, Button, Card} from 'antd';
import {Block, Root, ClientConnection} from "../../src/core";
import {makeLocalConnection} from "../../src/core/connect/LocalConnection";
import {TIcon} from "../../src/editor/icon/Icon";
import {sampleData} from "./sample-data";
import {initEditor, PropertyList, BlockStage, NodeTree} from "../../src/editor";
import {DragDropDiv, DragState} from "rc-dock";

interface Props {
  conn: ClientConnection;
}

interface State {
  selectedKeys: string[];
}

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
    return (
      <div style={{height: '100%'}}>

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
                style={{width: '300px', height: '800px', left: '1120px', top: '10px', position: 'absolute'}}>
            <PropertyList conn={conn} keys={selectedKeys}
            />
          </Card>

          <DragDropDiv onDragStartT={this.onDragBlock}> Drag Add </DragDropDiv>
          <DragDropDiv onDragStartT={this.onDragSlider}> Drag Slider </DragDropDiv>


        </div>
      </div>
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
