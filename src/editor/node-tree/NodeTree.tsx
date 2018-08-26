import * as React from "react";
import {ExpandState, TreeItem, renderTreeItem} from "../../ui/component/Tree";
import VirtualList from "../../ui/component/Virtual";
import {ClientConnection} from "../../common/connect/ClientConnection";
import {DataMap} from "../../common/util/Types";


class NodeTreeItem implements TreeItem {
  level: number;
  key: string;
  childPrefix: string;
  name: string;

  filter: string;
  max: number = 16;
  listingId: string;

  connection: ClientConnection;

  opened: ExpandState = false;

  children?: NodeTreeItem[];

  openedChangeCallback?: () => void;

  // a callback to update UI state
  refreshListCallback: () => void;

  constructor(name: string, refreshList: () => void, parent?: NodeTreeItem) {
    if (!parent) {
      // root element;
      this.level = 0;
      if (name) {
        this.key = name;
        this.childPrefix = `${name}.`;
        this.name = name.substr(name.indexOf('.') + 1);
      } else {
        this.key = '';
        this.childPrefix = '';
        this.name = 'Root';
      }
    } else {
      this.connection = parent.connection;
      this.level = parent.level + 1;
      this.key = `${parent.childPrefix}${name}`;
      this.childPrefix = `${this.key}.`;
      this.name = name;
    }

    this.refreshListCallback = refreshList;
  }

  renderer(): React.ReactNode | React.ReactNode[] {
    return <span>{this.name}</span>;
  }

  expand(open: boolean): void {
    if (this.opened === open) {
      return;
    }
    if (this.listingId) {
      this.connection.cancel(this.listingId);
      this.listingId = null;
    }
    if (open) {
      if (this.children) {
        this.opened = open;
        this.refreshListCallback();
      } else {
        this.opened = 'loading';
        this.listingId = this.connection.listChildren(this.key, this.filter, this.max, this) as string;
      }
    } else {
      this.opened = false;
      this.children = null;
      this.refreshListCallback();
    }

    if (this.openedChangeCallback) {
      this.openedChangeCallback();
    }
  }


  onUpdate(response: DataMap): void {
    if (!this.children) {
      this.children = [];
    }
    let children: DataMap = response.children;
    for (let key in children) {
      let newItem = new NodeTreeItem(key, this.refreshListCallback, this);
      this.children.push(newItem);
    }
    if (this.opened === 'loading') {
      this.expand(true);
    }
  }

  onError(error: string, data?: DataMap): void {
    // TODO: show error
  }

  addToList(list: NodeTreeItem[]) {
    list.push(this);
    if (this.opened === true && this.children) {
      for (let child of this.children) {
        child.addToList(list);
      }
    }
  }

  onAttachUI(): void {
    // do nothing
  }

  onDetachUI(): void {
    if (this.listingId) {
      this.connection.cancel(this.listingId);
      this.listingId = null;
    }
  }
}

interface Props {
  conn: ClientConnection;
  basePath: string;
  style?: React.CSSProperties;
}

interface State {

  itemHeight: number;
  renderer: (idx: number, style: React.CSSProperties) => React.ReactNode;
}

export default class NodeTree extends React.PureComponent<Props, State> {
  rootList: NodeTreeItem[] = [];
  state: State;
  list: NodeTreeItem[] = [];

  renderChild(idx: number, style: React.CSSProperties): React.ReactNode {
    return renderTreeItem(this.list[idx], style);
  }

  onListChange = () => this.forceUpdate();

  refreshList() {
    this.list.length = 0;
    for (let item of this.rootList) {
      item.addToList(this.list);
    }
  }

  constructor(props: Props) {
    super(props);
    let rootNode = new NodeTreeItem(props.basePath, this.onListChange);
    rootNode.connection = props.conn;
    this.rootList.push(rootNode);
    this.state = {
      itemHeight: 30,
      renderer: (i, style) => this.renderChild(i, style)
    };
  }

  render() {
    this.refreshList();
    return (
      <VirtualList
        style={this.props.style}
        renderer={this.state.renderer}
        itemCount={this.list.length}
        itemHeight={this.state.itemHeight}
      />
    );
  }
}