import React from 'react';
import {ExpandState} from '../component/Tree.tsx';
import VirtualList from '../component/Virtual.tsx';
import {ClientConn, arrayEqual, blankFuncDesc} from '@ticlo/core/editor.ts';
import {
  NodeTreeItem,
  NodeTreeRenderer,
  type LibraryAutoLoad,
  type NodeTreeFunctionDrag,
  type NodeTreeOpenAction,
} from './NodeRenderer.tsx';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent.tsx';
import {requestCallbacks} from '../util/RequestCallbacks.ts';
import type {MainFlowEntry} from '@ticlo/core/block/FlowRuntime.ts';
import {StoredFlowRenderer, type StoredFlowItem} from './StoredFlowItem.tsx';

export type {NodeTreeOpenAction} from './NodeRenderer.tsx';
export type {LibraryAutoLoad} from './NodeRenderer.tsx';

interface Props {
  conn: ClientConn;
  basePaths: string[];
  style?: React.CSSProperties;
  hideRoot?: boolean;
  tags?: readonly string[];
  selectedKeys?: string[];
  autoExpandSelected?: boolean;
  onSelect?: (keys: string[]) => void;
  /** Custom open actions; double-click uses the first action. */
  openActions?: readonly NodeTreeOpenAction[];
  libraryAutoLoad?: LibraryAutoLoad;
  showStoredFlows?: boolean;
  onOpenStoredFlow?: (path: string, canApply: boolean) => void;
}

export class NodeTree extends LazyUpdateComponent<Props, any> {
  static defaultProps: any = {
    selectedKeys: [],
  };

  rootList: NodeTreeItem[] = [];
  list: NodeTreeItem[] = [];
  rows: (NodeTreeItem | StoredFlowItem)[] = [];
  private pendingExpansion: string[] = [];
  private storedRoot: StoredFlowItem = {key: '', name: '', level: -1, children: new Map()};
  private expandedStored = new Set<string>();
  private storedRequest = 0;

  refreshStoredFlows = async () => {
    if (!this.props.showStoredFlows) return;
    const request = ++this.storedRequest;
    try {
      const {flows} = (await this.props.conn.listMainFlows()) as {flows: MainFlowEntry[]};
      if (request !== this.storedRequest) return;
      const root: StoredFlowItem = {key: '', name: '', level: -1, children: new Map()};
      for (const flow of flows) {
        const parts =
          flow.namespace === '#root' ? flow.name.split('.') : [`+${flow.namespace}`, ...flow.name.split('.')];
        let parent = root;
        for (const name of parts) {
          const key = parent.key ? `${parent.key}.${name}` : name;
          let item = parent.children.get(key);
          if (!item) {
            item = {key, name, level: parent.level + 1, children: new Map()};
            parent.children.set(key, item);
          }
          parent = item;
        }
        parent.autoLoad = flow.autoLoad;
        parent.canAutoLoad = flow.canAutoLoad;
      }
      this.storedRoot = root;
      this.forceUpdate();
    } catch (error) {
      if (request === this.storedRequest) requestCallbacks.onError(String(error));
    }
  };

  onStoredOpen = async (item: StoredFlowItem) => {
    if (!this.props.conn.getEditPolicyView().can({cmd: 'loadFlow', path: item.key})) return;
    try {
      await this.props.conn.loadFlow(item.key);
      const dot = item.key.lastIndexOf('.');
      const parent = dot < 0 ? '' : item.key.slice(0, dot);
      this.props.conn.childrenChangeStream().dispatch({path: parent, showNode: true});
      if (this.props.onOpenStoredFlow) {
        let canApply = false;
        try {
          const escaped = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const result = await this.props.conn.list(parent, `^${escaped}$`, 1);
          canApply = Boolean(result?.children?.[item.name]?.canApply);
        } catch {
          // A scoped read policy may allow the flow but not its parent listing.
        }
        this.props.onOpenStoredFlow(item.key, canApply);
      }
    } catch (error) {
      requestCallbacks.onError(String(error));
    }
  };

  onStoredAutoLoad = async (item: StoredFlowItem) => {
    if (!this.props.conn.getEditPolicyView().can({cmd: 'setAutoLoadFlow', path: item.key})) return;
    try {
      await this.props.conn.setAutoLoadFlow(item.key, !item.autoLoad);
      const dot = item.key.lastIndexOf('.');
      this.props.conn.childrenChangeStream().dispatch({path: dot < 0 ? '' : item.key.slice(0, dot), showNode: true});
    } catch (error) {
      requestCallbacks.onError(String(error));
    }
  };

  private appendStored(item: StoredFlowItem) {
    this.rows.push(item);
    if (this.expandedStored.has(item.key)) {
      for (const child of item.children.values()) this.appendStored(child);
    }
  }

  private appendLive(item: NodeTreeItem, stored?: StoredFlowItem) {
    if (item.level >= 0) this.rows.push(item);
    if (item.opened !== 'opened') return;
    const live = new Set<string>();
    for (const child of item.children ?? []) {
      live.add(child.key);
      this.appendLive(child, stored?.children.get(child.key));
    }
    for (const child of stored?.children.values() ?? []) {
      if (!live.has(child.key)) this.appendStored(child);
    }
  }

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
          const siblings = this.rows.filter(
            (child): child is NodeTreeItem => child instanceof NodeTreeItem && child.parent === item.parent
          );
          let idx0 = siblings.indexOf(item);
          let idx1 = siblings.indexOf(this.lastClickedItem);
          if (idx0 < 0 || idx1 < 0 || idx0 === idx1) {
            // not a valid shift click
            return;
          }
          if (idx0 > idx1) {
            [idx0, idx1] = [idx1, idx0];
          }
          for (let i = idx0; i <= idx1; ++i) {
            const childKey = siblings[i].key;
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

  // REFACTOR(design.md): MUST preserve attached wire IDs, routes, and order when moving blocks.
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

  // REFACTOR(design.md): MUST create a block with fixed type, persistent ID, and stable ports.
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
    const item = this.rows[idx];
    if (!(item instanceof NodeTreeItem)) {
      const policy = this.props.conn.getEditPolicyView();
      return (
        <StoredFlowRenderer
          item={item}
          key={item.key}
          style={style}
          expanded={this.expandedStored.has(item.key)}
          onExpand={() => {
            if (this.expandedStored.has(item.key)) this.expandedStored.delete(item.key);
            else this.expandedStored.add(item.key);
            this.forceUpdate();
          }}
          onOpen={() => void this.onStoredOpen(item)}
          onAutoLoad={() => void this.onStoredAutoLoad(item)}
          canLoad={policy.can({cmd: 'loadFlow', path: item.key})}
          canAutoLoad={Boolean(item.canAutoLoad && policy.can({cmd: 'setAutoLoadFlow', path: item.key}))}
        />
      );
    }
    return (
      <NodeTreeRenderer
        item={item}
        key={item.key}
        style={style}
        selected={selectedKeys.includes(item.key)}
        onClick={this.onItemClick}
        openActions={this.props.openActions}
        libraryAutoLoad={this.props.libraryAutoLoad}
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
    void this.refreshStoredFlows();
  };

  forceUpdateLambda = () => {
    this.expandSelected();
    this.forceUpdate();
  };

  private expandSelectedPath(item: NodeTreeItem, path: string): boolean {
    if (item.key === path) return true;
    const {tags} = this.props;
    if (tags && item.level >= 0 && !item.desc.tags?.some((tag) => tags.includes(tag))) {
      return item.desc !== blankFuncDesc;
    }
    if (item.opened === 'closed' || item.opened === 'empty') item.open();
    if (item.opened !== 'opened') return false;
    const child = item.children?.find((child) => child.key === path || path.startsWith(child.childPrefix));
    return !child || this.expandSelectedPath(child, path);
  }

  private expandSelected() {
    const paths = this.pendingExpansion;
    this.pendingExpansion = [];
    for (const path of paths) {
      const root = this.rootList.find((item) => item.key === path || path.startsWith(item.childPrefix));
      if (root && !this.expandSelectedPath(root, path)) this.pendingExpansion.push(path);
    }
  }

  private updateSelectedExpansion() {
    this.pendingExpansion = this.props.autoExpandSelected ? [...this.props.selectedKeys] : [];
    this.expandSelected();
  }

  refreshList() {
    this.list.length = 0;
    for (const item of this.rootList) {
      item.addToList(this.list, this.props.tags);
    }
    if (this.props.showStoredFlows && !this.props.tags) {
      this.rows = [];
      for (const item of this.rootList) this.appendLive(item, this.storedRoot);
    } else {
      this.rows = this.list;
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
      void this.refreshStoredFlows();
    } else if (previous.showStoredFlows !== this.props.showStoredFlows) {
      void this.refreshStoredFlows();
    } else if (
      previous.autoExpandSelected !== this.props.autoExpandSelected ||
      previous.tags !== this.props.tags ||
      !arrayEqual(previous.selectedKeys, this.props.selectedKeys)
    ) {
      this.updateSelectedExpansion();
    }
  }

  reload() {
    for (const node of this.rootList) {
      node.open();
    }
    void this.refreshStoredFlows();
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
    this.updateSelectedExpansion();
    void this.refreshStoredFlows();
    this.forceUpdate();
  }

  renderImpl() {
    this.refreshList();
    return (
      <VirtualList
        className="ticl-e-node-tree"
        style={this.props.style}
        renderer={this.renderChild}
        itemCount={this.rows.length}
        itemHeight={30}
      />
    );
  }

  clearRoot(conn: ClientConn) {
    ++this.storedRequest;
    this.storedRoot = {key: '', name: '', level: -1, children: new Map()};
    this.expandedStored.clear();
    conn.childrenChangeStream().unlisten(this.onChildrenChange);
    for (const node of this.rootList) {
      node.destroy();
    }
    this.rootList = [];
    this.pendingExpansion = [];
    this.lastClickedItem = null;
  }

  componentWillUnmount(): void {
    super.componentWillUnmount();
    this.clearRoot(this.props.conn);
  }
}
