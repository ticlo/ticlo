import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {Menu, Icon, Dropdown, Button} from 'antd';
import NodeTree from "../../src/editor/node-tree/NodeTree";
import {Block, Root} from "../../src/common/block/Block";
import {makeLocalConnection} from "../../src/common/connect/LocalConnection";
import {TIcon} from "../../src/editor/icon/Icon";
import '../../src/common/functions/basic/Math';
import {sampleData} from "./sample-data";
import BlockStage from "../../src/editor/block/BlockStage";


let job = Root.instance.addJob('example');
job.load(sampleData);


let [server, client] = makeLocalConnection(Root.instance);

ReactDOM.render(
  <div style={{height: '100%'}}>

    <div>
      <NodeTree conn={client} basePath="example" style={{width: '300px', height: '600px'}}/>
      <BlockStage conn={client} basePath="example"
                  style={{width: '800px', height: '800px', left: '300px', position: 'absolute'}}/>
    </div>
  </div>,
  document.getElementById('app')
);
