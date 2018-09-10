import * as React from "react";

import {Dropdown, Button, Input, Icon, Menu, InputNumber} from "antd";
import {ExpandIcon, ExpandState} from "../../ui/component/Tree";
import {DataMap} from "../../common/util/Types";
import {ClientConnection} from "../../common/connect/ClientConnection";

export class NodeTreeItem {
  level: number;
  key: string;
  childPrefix: string;
  name: string;

  filter: string;
  max: number = 32;

  opened: ExpandState = 'closed';

  children?: NodeTreeItem[];


  constructor(name: string, parent?: NodeTreeItem) {
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
      this.level = parent.level + 1;
      this.key = `${parent.childPrefix}${name}`;
      this.childPrefix = `${this.key}.`;
      this.name = name;
    }
  }


  addToList(list: NodeTreeItem[]) {
    list.push(this);
    if (this.opened === 'opened' && this.children) {
      for (let child of this.children) {
        child.addToList(list);
      }
    }
  }
}

interface Props {
  item: NodeTreeItem;
  style: React.CSSProperties;
  onListChange: () => void;
  connection: ClientConnection;
}

interface State {
  opened: ExpandState;
  menuShown: boolean;
}


export class NodeTreeRenderer extends React.Component<Props, State> {

  listingId: string;


  onExpandClicked = () => {
    if (this.listingId) {
      this.props.connection.cancel(this.listingId);
      this.listingId = null;
    }
    switch (this.state.opened) {
      case 'opened':
        this.close();
        break;
      case 'closed':
      case 'empty':
        this.open();
        break;
    }
  };
  onReloadClicked = (event?: MouseEvent) => {
    if (this.listingId) {
      this.props.connection.cancel(this.listingId);
      this.listingId = null;
    }
    this.loadChildren();
  };

  open() {
    let {item} = this.props;
    if (item.children) {
      console.log('show');
      this.showChildren();
    } else {
      console.log('reload');
      this.loadChildren();
    }
  }

  loadChildren() {
    let {item, connection} = this.props;
    this.listingId = connection.listChildren(item.key, item.filter, item.max, this) as string;
    this.setState({opened: 'loading'});
  }

  close() {
    this.props.item.opened = 'closed';
    this.props.onListChange();
    this.setState({opened: "closed"});
  }

  showChildren() {
    let {item} = this.props;
    item.opened = 'opened';
    this.setState({opened: 'opened'});
    this.props.onListChange();
  }

  // on children update
  onUpdate(response: DataMap): void {
    let {item} = this.props;
    item.children = [];
    if (this.listingId) {
      this.listingId = null;
    }
    let children: DataMap = response.children;
    for (let key in children) {
      let newItem = new NodeTreeItem(key, item);
      item.children.push(newItem);
    }
    this.showChildren();
  }

  // on children error
  onError(error: string, data?: DataMap): void {
    // TODO: show error
  }


  constructor(props: Props) {
    super(props);

    this.state = {opened: props.item.opened, menuShown: false};
  }

  shouldComponentUpdate(nextProps: Readonly<Props>, nextState: Readonly<State>, nextContext: any): boolean {
    if (nextProps.item !== this.props.item) {
      this.setState({opened: nextProps.item.opened});
      if (this.listingId) {
        this.props.connection.cancel(this.listingId);
        this.listingId = null;
      }
    } else if (nextProps.style !== this.props.style || nextState.opened !== this.state.opened) {
      return true;
    }
    return false;
  }

  render() {
    let {item, style} = this.props;
    let marginLeft = item.level * 24;
    return (
      <div style={{...style, marginLeft}} className="ticl-tree-node">
        <ExpandIcon opened={this.state.opened} onClick={this.onExpandClicked}/>

        <Dropdown overlay={
          <Menu prefixCls="ant-dropdown-menu" selectable={false}>
            <Menu.Item onClick={this.onReloadClicked}>
              <div className="fas fas fa-sync-alt ticl-icon"/>
              Reload
            </Menu.Item>
          </Menu>
        } trigger={['contextMenu']}>
          <div className="ticl-tree-node-text">{item.name}</div>
        </Dropdown>

      </div>
    );
  }

  componentWillUnmount() {
    if (this.listingId) {
      this.props.connection.cancel(this.listingId);
      this.listingId = null;
    }
  }
}