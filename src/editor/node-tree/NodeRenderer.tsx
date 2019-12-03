import React from 'react';

import {Dropdown, Button, Input, Menu, InputNumber} from 'antd';
import BuildIcon from '@ant-design/icons/BuildOutlined';
import ReloadIcon from '@ant-design/icons/ReloadOutlined';
import SearchIcon from '@ant-design/icons/SearchOutlined';
import {ExpandIcon, ExpandState, TreeItem} from '../../ui/component/Tree';
import {PureDataRenderer} from '../../ui/component/DataRenderer';
import {DataMap} from '../../core/util/DataTypes';
import {ClientConn, ValueUpdate} from '../../core/client';
import {TIcon} from '../icon/Icon';
import {blankFuncDesc, FunctionDesc, getFuncStyleFromDesc} from '../../core/block/Descriptor';
import {ClickParam} from 'antd/lib/menu';
import {smartStrCompare} from '../../core/util/String';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext';

export class NodeTreeItem extends TreeItem<NodeTreeItem> {
  childPrefix: string;
  name: string;

  max: number = 32;

  constructor(name: string, parent?: NodeTreeItem, public editable = false) {
    super(parent);
    if (parent) {
      this.key = `${parent.childPrefix}${name}`;
      this.childPrefix = `${this.key}.`;
      this.name = name;
    } else {
      // root element;
      if (name) {
        this.key = name;
        this.childPrefix = `${name}.`;
        this.name = name.substr(name.indexOf('.') + 1);
      } else {
        this.key = '';
        this.childPrefix = '';
        this.name = 'Root';
      }
    }
  }

  addToList(list: NodeTreeItem[]) {
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
    this.forceUpdate();
  }

  close() {
    this.cancelLoad();
    this.opened = 'closed';
    this.forceUpdate();
    if (this.onListChange && this.children && this.children.length) {
      this.onListChange();
    }
  }

  reload() {
    this.cancelLoad();
    this.opened = 'loading';
    this.listingId = this.connection.listChildren(this.key, null, this.max, this) as string;
    this.forceUpdate();
  }

  // on children update
  onUpdate(response: DataMap): void {
    this.destroyChildren();
    this.children = [];
    if (this.listingId) {
      this.listingId = null;
    }
    let children: DataMap = response.children;
    let names = Object.keys(children);
    names.sort(smartStrCompare);
    for (let key of names) {
      let data = children[key];
      let newItem = new NodeTreeItem(key, this, data.editable);
      this.children.push(newItem);
    }
    this.opened = 'opened';
    if (this.onListChange) {
      this.onListChange();
    }
    this.forceUpdate();
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
    super.destroy();
  }
}

interface Props {
  item: NodeTreeItem;
  style: React.CSSProperties;
}

export class NodeTreeRenderer extends PureDataRenderer<Props, any> {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  onExpandClicked = () => {
    let {item} = this.props;
    switch (item.opened) {
      case 'opened':
        item.close();
        break;
      case 'closed':
      case 'empty':
        item.open();
        break;
    }
  };
  onReloadClicked = (event?: ClickParam) => {
    this.props.item.reload();
  };
  onOpenClicked = (event?: ClickParam) => {
    const {item} = this.props;
    if (this.context && this.context.editJob) {
      this.context.editJob(item.key, () => {
        item.getConn().applyWorkerChange(item.key);
      });
    }
  };
  subscriptionListener = {
    onUpdate: (response: ValueUpdate) => {
      let {item} = this.props;
      let className = response.cache.value;
      if (typeof className === 'string') {
        item.connection.watchDesc(className, this.descCallback);
      } else {
        item.connection.unwatchDesc(this.descCallback);
      }
    }
  };

  constructor(props: Props) {
    super(props);
    let {item} = props;
    item.connection.subscribe(`${item.key}.#is`, this.subscriptionListener, true);
  }

  desc: FunctionDesc = blankFuncDesc;
  descCallback = (desc: FunctionDesc) => {
    this.desc = desc || blankFuncDesc;
    this.forceUpdate();
  };

  getMenu = () => {
    let editJob = this.context && this.context.editJob;
    return (
      <Menu selectable={false}>
        {editJob ? (
          <Menu.Item onClick={this.onOpenClicked}>
            <BuildIcon />
            Open
          </Menu.Item>
        ) : null}
        <Menu.Item onClick={this.onReloadClicked}>
          <ReloadIcon />
          Reload
        </Menu.Item>
        <Menu.Item>
          <SearchIcon />
          Search
        </Menu.Item>
      </Menu>
    );
  };

  renderImpl() {
    let {item, style} = this.props;
    let marginLeft = item.level * 20;
    return (
      <div style={{...style, marginLeft}} className="ticl-tree-node">
        <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
        <TIcon icon={this.desc.icon} style={getFuncStyleFromDesc(this.desc, 'tico-pr')} />
        <Dropdown overlay={this.getMenu} trigger={['contextMenu']}>
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
