import * as React from "react";
import {ExpandState, TreeItem, renderTreeItem} from "../../ui/component/Tree";
import VirtualList from "../../ui/component/Virtual";

class NodeTreeItem implements TreeItem {
  level: number;
  key: string;
  name: string;
  opened: ExpandState = false;

  children?: NodeTreeItem[];

  openedChangeCallback?: () => void;

  // a callback to update UI state
  refreshListCallback: () => void;

  constructor(name: string, refreshList: () => void, parent?: TreeItem) {
    if (!parent) {
      // root element;
      this.level = 0;
      this.key = name;
    } else {
      this.level = parent.level + 1;
      this.key = `${parent.key}.${name}`;
    }
    this.name = name;
    this.refreshListCallback = refreshList;
  }

  renderer(): React.ReactNode | React.ReactNode[] {
    return <span>{this.name}</span>;
  }

  expand(open: boolean): void {
    if (this.opened === open) {
      return;
    }
    if (open) {
      if (this.children) {
        this.opened = open;
        this.refreshListCallback();
      } else {
        this.opened = 'loading';
        setTimeout(() => this.createChildren(), 300);
      }
    } else {
      this.opened = false;
      if (this.children && this.children.length) {
        this.closeChildren();
        this.refreshListCallback();
      }
    }

    if (this.openedChangeCallback) {
      this.openedChangeCallback();
    }
  }

  closeChildren() {
    if (this.children) {
      for (let child of this.children) {
        child.opened = false;
        child.closeChildren();
      }
    }
  }

  createChildren() {
    if (!this.children) {
      this.children = [];
      for (let i = 0; i < 6; ++i) {
        let newItem = new NodeTreeItem(Math.random().toString(36).substr(-4), this.refreshListCallback, this);
        this.children.push(newItem);
      }
      if (this.opened === 'loading') {
        this.expand(true);
      }
    }
  }


  addTo(list: NodeTreeItem[]) {
    list.push(this);
    if (this.opened === true && this.children) {
      for (let child of this.children) {
        child.addTo(list);
      }
    }
  }

}

interface Props {
  style?: React.CSSProperties;
}

interface State {
  list: NodeTreeItem[];
  itemHeight: number;
  renderer: (idx: number, style: React.CSSProperties) => React.ReactNode;
}

export default class NodeTree extends React.PureComponent<Props, State> {
  rootList: NodeTreeItem[] = [];
  state: State;

  renderChild(idx: number, style: React.CSSProperties): React.ReactNode {
    return renderTreeItem(this.state.list[idx], style);
  }


  refreshList = () => {
    let list: NodeTreeItem[] = [];
    for (let item of this.rootList) {
      item.addTo(list);
    }
    this.setState({list});
  };

  constructor(props: object) {
    super(props);
    let list: NodeTreeItem[] = [];
    for (let i = 0; i < 20; ++i) {
      let newItem = new NodeTreeItem(Math.random().toString(36).substr(-4), this.refreshList);
      list.push(newItem);
    }
    this.rootList = list;
    this.state = {
      list,
      itemHeight: 30,
      renderer: (i, style) => this.renderChild(i, style)
    };
  }

  render() {
    return (
      <VirtualList
        style={this.props.style}
        renderer={this.state.renderer}
        itemCount={this.state.list.length}
        itemHeight={this.state.itemHeight}
      />
    );
  }
}