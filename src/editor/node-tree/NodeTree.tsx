import React from "react";
import {ExpandState} from "../../ui/component/Tree";
import VirtualList from "../../ui/component/Virtual";
import {ClientConn} from "../../core/client";
import {DataMap} from "../../core/util/Types";
import {NodeTreeItem, NodeTreeRenderer} from "./NodeRenderer";


interface Props {
  conn: ClientConn;
  basePaths: string[];
  style?: React.CSSProperties;
  hideRoot?: boolean;
}

export class NodeTree extends React.PureComponent<Props, any> {
  rootList: NodeTreeItem[] = [];
  list: NodeTreeItem[] = [];

  renderChild = (idx: number, style: React.CSSProperties) => {
    const item = this.list[idx];
    return (
      <NodeTreeRenderer item={item} key={item.key} style={style}/>
    );
  };

  forceUpdateLambda = () => this.forceUpdate();
  forceUpdateImmediate = () => {
    this.props.conn.callImmediate(this.forceUpdateLambda);
  };

  refreshList() {
    this.list.length = 0;
    for (let item of this.rootList) {
      item.addToList(this.list);
    }
  }

  constructor(props: Props) {
    super(props);
    this.buildRoot();
  }

  buildRoot() {
    let {basePaths, hideRoot} = this.props;
    for (let basePath of basePaths) {
      let rootNode = new NodeTreeItem(basePath);
      rootNode.connection = this.props.conn;
      rootNode.onListChange = this.forceUpdateImmediate;
      this.rootList.push(rootNode);
    }
    if (hideRoot && basePaths.length === 1) {
      this.rootList[0].level = -1;
      this.rootList[0].open();
    }
  }

  render() {
    this.refreshList();
    return (
      <VirtualList
        className='ticl-node-tree'
        style={this.props.style}
        renderer={this.renderChild}
        itemCount={this.list.length}
        itemHeight={30}
      />
    );
  }

  componentWillUnmount(): void {
    for (let node of this.rootList) {
      node.destroy();
    }
  }
}
