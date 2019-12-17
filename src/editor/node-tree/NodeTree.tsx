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
  onSelect?: (keys: string[]) => void;
}

export class NodeTree extends LazyUpdateComponent<Props, any> {
  static defaultProps: any = {
    selectedKeys: []
  };

  rootList: NodeTreeItem[] = [];
  list: NodeTreeItem[] = [];

  onItemClick = (item: NodeTreeItem, ctrl: boolean) => {
    let {selectedKeys, onSelect} = this.props;
    if (!onSelect) {
      return;
    }
    let keys = [...selectedKeys];
    if (ctrl) {
      if (keys.includes(item.key)) {
        keys = keys.filter((value) => value !== item.key);
      } else {
        keys.push(item.key);
      }
    } else {
      if (keys.length === 1 && keys[0] === item.key) {
        return;
      }
      keys = [item.key];
    }
    onSelect(keys);
  };

  renderChild = (idx: number, style: React.CSSProperties) => {
    let {selectedKeys} = this.props;
    const item = this.list[idx];
    return (
      <NodeTreeRenderer
        item={item}
        key={item.key}
        style={style}
        selected={selectedKeys.includes(item.key)}
        onClick={this.onItemClick}
      />
    );
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
