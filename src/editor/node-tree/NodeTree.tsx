import React from 'react';
import {ExpandState} from '../../ui/component/Tree';
import VirtualList from '../../ui/component/Virtual';
import {ClientConn} from '../../core/client';
import {DataMap} from '../../core/util/DataTypes';
import {NodeTreeItem, NodeTreeRenderer} from './NodeRenderer';
import {LazyUpdateComponent} from '../../ui/component/LazyUpdateComponent';

interface Props {
  conn: ClientConn;
  basePaths: string[];
  style?: React.CSSProperties;
  hideRoot?: boolean;
  selectedKeys?: string[];
}

export class NodeTree extends LazyUpdateComponent<Props, any> {
  static defaultProps: any = {
    selectedKeys: []
  };

  rootList: NodeTreeItem[] = [];
  list: NodeTreeItem[] = [];

  renderChild = (idx: number, style: React.CSSProperties) => {
    let {selectedKeys} = this.props;
    const item = this.list[idx];
    return <NodeTreeRenderer item={item} key={item.key} style={style} selected={selectedKeys.includes(item.key)} />;
  };

  forceUpdateLambda = () => this.forceUpdate();

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
      rootNode.onListChange = this.forceUpdateLambda;
      this.rootList.push(rootNode);
    }
    if (hideRoot && basePaths.length === 1) {
      this.rootList[0].level = -1;
      this.rootList[0].open();
    }
  }

  renderImpl() {
    this.refreshList();
    return (
      <VirtualList
        className="ticl-node-tree"
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
