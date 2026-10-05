import React from 'react';
import {ExpandState} from '../component/Tree.tsx';
import VirtualList from '../component/Virtual.tsx';
import {ClientConn, arrayEqual} from '@ticlo/core/editor.ts';
import {NodeTreeItem, NodeTreeRenderer, type NodeTreeFunctionDrag} from './NodeRenderer.tsx';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent.tsx';
import {requestCallbacks} from '../util/RequestCallbacks.ts';

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
    selectedKeys: [],
  };

  rootList: NodeTreeItem[] = [];
  list: NodeTreeItem[] = [];

  lastClickedItem: NodeTreeItem;
  onItemClick = (item: NodeTreeItem, event: React.MouseEvent) => {
    const {selectedKeys, onSelect} = this.props;
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
            const childKey = item.parent.children[i].key;
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

  getOrderedDrag = (item: NodeTreeItem): NodeTreeItem[] => {
    const {selectedKeys} = this.props;
    if (!item.parent || !item.ordered) return;
    if (!selectedKeys.includes(item.key)) return [item];
    const items = item.parent.children.filter((child) => selectedKeys.includes(child.key));
    if (items.length === selectedKeys.length && items.every((child) => child.ordered)) return items;
  };

  canDropOrdered = (items: NodeTreeItem[], target: NodeTreeItem, index?: number) => {
    const current = this.getOrderedDrag(items[0]);
    if (!current || current.length !== items.length || current.some((item, i) => item !== items[i])) return false;
    for (const item of items) {
      if (!target.desc.childrenTags?.some((tag) => item.desc.tags?.includes(tag))) return false;
      for (let parent = target; parent; parent = parent.parent) {
        if (parent === item) return false;
      }
    }
    return this.props.conn.getEditPolicyView().can({
      cmd: 'moveOrdered',
      path: items[0].parent.key,
      props: items.map((item) => item.name),
      to: target.key,
      index,
    });
  };

  onDropOrdered = (items: NodeTreeItem[], target: NodeTreeItem, index?: number) => {
    if (!this.canDropOrdered(items, target, index)) return;
    const {conn, onSelect} = this.props;
    const source = items[0].parent;
    conn.moveOrdered(
      source.key,
      items.map((item) => item.name),
      target.key,
      index,
      {
        ...requestCallbacks,
        onUpdate: ({moved}) => {
          if (source !== target) {
            conn.childrenChangeStream().dispatch({path: source.key});
            conn.childrenChangeStream().dispatch({path: target.key, showNode: true});
          }
          onSelect?.((moved as string[]).map((name) => `${target.childPrefix}${name}`));
        },
      }
    );
  };

  canDropFunction = (drag: NodeTreeFunctionDrag, target: NodeTreeItem, index?: number) => {
    if (!drag.name || drag.data['#is'] !== drag.desc.id) return false;
    if (!target.desc.childrenTags?.some((tag) => drag.desc.tags?.includes(tag))) return false;
    return this.props.conn.getEditPolicyView().can({
      cmd: 'addBlock',
      path: `${target.childPrefix}${drag.name}`,
      data: drag.data,
      findName: true,
      orderIndex: index ?? (Array.isArray(target.order) ? target.order.length : 0),
    });
  };

  onDropFunction = (drag: NodeTreeFunctionDrag, target: NodeTreeItem, index?: number) => {
    if (!this.canDropFunction(drag, target, index)) return;
    const {conn, onSelect} = this.props;
    conn.addBlock(
      `${target.childPrefix}${drag.name}`,
      drag.data,
      true,
      index ?? (Array.isArray(target.order) ? target.order.length : 0),
      {
        ...requestCallbacks,
        onUpdate: ({name}) => {
          conn.childrenChangeStream().dispatch({path: target.key, showNode: true});
          onSelect?.([`${target.childPrefix}${name}`]);
        },
      }
    );
  };

  renderChild = (idx: number, style: React.CSSProperties) => {
    const {selectedKeys} = this.props;
    const item = this.list[idx];
    return (
      <NodeTreeRenderer
        item={item}
        key={item.key}
        style={style}
        selected={selectedKeys.includes(item.key)}
        onClick={this.onItemClick}
        getOrderedDrag={this.getOrderedDrag}
        canDropOrdered={this.canDropOrdered}
        onDropOrdered={this.onDropOrdered}
        canDropFunction={this.canDropFunction}
        onDropFunction={this.onDropFunction}
      />
    );
  };

  onChildrenChange = ({path, showNode}: {path: string; showNode?: boolean}) => {
    for (const node of this.rootList) {
      node.onChildrenChange(path, false, showNode);
    }
  };

  forceUpdateLambda = () => this.forceUpdate();

  refreshList() {
    this.list.length = 0;
    for (const item of this.rootList) {
      item.addToList(this.list);
    }
  }

  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    super.componentDidMount();
    this.buildRoot();
  }

  componentDidUpdate(previous: Props) {
    if (
      previous.conn !== this.props.conn ||
      !arrayEqual(previous.basePaths, this.props.basePaths) ||
      previous.hideRoot !== this.props.hideRoot
    ) {
      this.clearRoot(previous.conn);
      this.buildRoot();
    }
  }

  reload() {
    for (const node of this.rootList) {
      node.open();
    }
  }

  buildRoot() {
    const {conn, basePaths, hideRoot} = this.props;
    for (const basePath of basePaths) {
      const rootNode = new NodeTreeItem(basePath, '');
      rootNode.connection = this.props.conn;
      rootNode.onListChange = this.forceUpdateLambda;
      rootNode.subscribe();
      this.rootList.push(rootNode);
    }
    if (hideRoot && basePaths.length === 1) {
      this.rootList[0].level = -1;
      this.rootList[0].open();
    }
    conn.childrenChangeStream().listen(this.onChildrenChange);
    this.forceUpdate();
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

  clearRoot(conn: ClientConn) {
    conn.childrenChangeStream().unlisten(this.onChildrenChange);
    for (const node of this.rootList) {
      node.destroy();
    }
    this.rootList = [];
    this.lastClickedItem = null;
  }

  componentWillUnmount(): void {
    super.componentWillUnmount();
    this.clearRoot(this.props.conn);
  }
}
