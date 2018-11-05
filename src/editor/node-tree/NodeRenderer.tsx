import * as React from "react";

import {Dropdown, Button, Input, Icon, Menu, InputNumber} from "antd";
import {ExpandIcon, ExpandState, TreeItem} from "../../ui/component/Tree";
import {PureDataRenderer} from "../../ui/component/DataRenderer";
import {DataMap} from "../../common/util/Types";
import {ClientConnection} from "../../common/connect/ClientConnection";
import {TIcon} from "../icon/Icon";
import {FunctionDesc} from "../../common/block/Descriptor";

export class NodeTreeItem extends TreeItem {
  onListChange: () => void;
  connection: ClientConnection;

  level: number;
  key: string;
  childPrefix: string;
  name: string;

  max: number = 32;

  constructor(name: string, parent?: NodeTreeItem) {
    super();
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

      this.connection = parent.connection;
      this.onListChange = parent.onListChange;
    }
  }

  addToList(list: TreeItem[]) {
    super.addToList(list);
    // TODO
  }

  listingId: string;

  open() {
    if (this.opened === 'loading') {
      return;
    }
    if (this.children) {
      this.opened = 'opened';
      if (this.onListChange && this.children.length) {
        this.onListChange();
      }
    } else {
      this.opened = 'loading';
      this.listingId = this.connection.listChildren(this.key, null, this.max, this) as string;
    }
    if (this._renderers) {
      this.forceUpdate();
    }
  }

  close() {
    this.cancelLoad();
    this.opened = 'closed';
    if (this._renderers) {
      this.forceUpdate();
    }
    if (this.onListChange && this.children && this.children.length) {
      this.onListChange();
    }
  }

  reload() {
    this.cancelLoad();
    this.opened = 'loading';
    this.listingId = this.connection.listChildren(this.key, null, this.max, this) as string;
    if (this._renderers) {
      this.forceUpdate();
    }
  }

  // on children update
  onUpdate(response: DataMap): void {
    this.destroyChildren();
    this.children = [];
    if (this.listingId) {
      this.listingId = null;
    }
    let children: DataMap = response.children;
    for (let key in children) {
      let newItem = new NodeTreeItem(key, this);
      this.children.push(newItem);
    }
    this.opened = 'opened';
    if (this.onListChange) {
      this.onListChange();
    }
    if (this._renderers) {
      this.forceUpdate();
    }
  }

  // on children error
  onError(error: string, data?: DataMap): void {
    // TODO: show error
  }

  cancelLoad() {
    if (this.listingId) {
      this.connection.cancel(this.listingId);
      this.listingId = null;
    }
  }

  destroy() {
    this.cancelLoad();
    this.destroyChildren();
  }
}

interface Props {
  item: NodeTreeItem;
  style: React.CSSProperties;
}

interface State {
  icon: string;
  iconStyle?: string;
}

export class NodeTreeRenderer extends PureDataRenderer<Props, State> {

  onExpandClicked = () => {
    switch (this.props.item.opened) {
      case 'opened':
        this.props.item.close();
        break;
      case 'closed':
      case 'empty':
        this.props.item.open();
        break;
    }
  };
  onReloadClicked = (event?: MouseEvent) => {
    this.props.item.reload();
  };
  subscriptionListener = {
    onUpdate: (response: DataMap) => {
      let {item} = this.props;
      let className = response.cache.value;
      if (typeof className === 'string') {
        console.log(className);
        item.connection.watchDesc(className, this.descCallback);
      } else {
        item.connection.unwatchDesc(this.descCallback);
      }
    }
  };

  constructor(props: Props) {
    super(props);
    this.state = {icon: '', iconStyle: null};
    let {item} = props;
    item.connection.subscribe(`${item.key}.#is`, this.subscriptionListener);
  }

  descCallback = (desc: FunctionDesc) => {
    if (desc) {
      this.preSetState({icon: desc.icon, iconStyle: desc.style ? desc.style.charAt(0) : `${desc.priority}`});
    } else {
      this.preSetState({icon: '', iconStyle: null});
    }
  };

  render() {
    let {item, style} = this.props;
    let marginLeft = item.level * 24;
    return (
      <div style={{...style, marginLeft}} className="ticl-tree-node">
        <ExpandIcon opened={item.opened} onClick={this.onExpandClicked}/>
        <TIcon icon={this.state.icon} style={this.state.iconStyle}/>
        <Dropdown overlay={
          <Menu prefixCls="ant-dropdown-menu" selectable={false}>
            <Menu.Item onClick={this.onReloadClicked}>
              <div className="fas fa-sync-alt ticl-icon"/>
              Reload
            </Menu.Item>
            <Menu.Item>
              <div className="fas fa-search ticl-icon"/>
              Search
            </Menu.Item>
          </Menu>
        } trigger={['contextMenu']}>
          <div className="ticl-tree-node-text">{item.name}</div>
        </Dropdown>
      </div>
    );
  }

  componentWillUnmount() {
    let {item} = this.props;
    item.connection.unsubscribe(`${item.key}.#is`, this.subscriptionListener);
    item.connection.unwatchDesc(this.descCallback);
    super.componentWillUnmount();
  }
}