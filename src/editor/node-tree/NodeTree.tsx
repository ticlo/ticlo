import React from 'react';
import {ExpandState} from '../component/Tree';
import VirtualList from '../component/Virtual';
import {ClientConn} from '../../../src/core/editor';
import {NodeTreeItem, NodeTreeRenderer} from './NodeRenderer';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent';

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

  lastClickedItem: NodeTreeItem;
  onItemClick = (item: NodeTreeItem, event: React.MouseEvent) => {
    let {selectedKeys, onSelect} = this.props;
    if (!onSelect) {
      return;
    }
    let keys = [...selectedKeys];
    if (event.ctrlKey || event.metaKey) {
      if (keys.includes(item.key)) {
        keys = keys.filter((value) => value !== item.key);
        this.lastClickedItem = null;
      } else {
        keys.push(item.key);
        this.lastClickedItem = item;
      }
    } else {
      if (keys.length === 1 && keys[0] === item.key) {
        // item already selected
        return;
      }
      if (event.shiftKey) {
        // shift click, select range
        if (item.parent.children && this.lastClickedItem?.parent === item.parent) {
          let idx0 = item.parent.children.indexOf(item);
          let idx1 = item.parent.children.indexOf(this.lastClickedItem);
          if (idx0 < 0 || idx1 < 0 || idx0 === idx1) {
            // not a valid shift click
            return;
          }
          if (idx0 > idx1) {
            [idx0, idx1] = [idx1, idx0];
          }
          for (let i = idx0; i <= idx1; ++i) {
            let childKey = item.parent.children[i].key;
            if (!keys.includes(childKey)) {
              keys.push(childKey);
            }
          }
        } else {
          // not a valid shift click
          return;
        }
      } else {
        keys = [item.key];
        this.lastClickedItem = item;
      }
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

  onChildrenChange = (parentPath: string) => {
    for (let node of this.rootList) {
      node.onChildrenChange(parentPath);
    }
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
    let {conn, basePaths, hideRoot} = this.props;
    for (let basePath of basePaths) {
      let rootNode = new NodeTreeItem(basePath, '');
      rootNode.connection = this.props.conn;
      rootNode.onListChange = this.forceUpdateLambda;
      this.rootList.push(rootNode);
    }
    if (hideRoot && basePaths.length === 1) {
      this.rootList[0].level = -1;
      this.rootList[0].open();
    }
    conn.childrenChangeStream().listen(this.onChildrenChange);
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
    this.props.conn.childrenChangeStream().unlisten(this.onChildrenChange);
    for (let node of this.rootList) {
      node.destroy();
    }
  }
}
