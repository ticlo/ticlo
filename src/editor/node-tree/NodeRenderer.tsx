import React from 'react';

import {Dropdown, Button, Input, Menu, InputNumber} from 'antd';
import BuildIcon from '@ant-design/icons/BuildOutlined';
import SaveIcon from '@ant-design/icons/SaveOutlined';
import DeleteIcon from '@ant-design/icons/DeleteOutlined';
import SearchIcon from '@ant-design/icons/SearchOutlined';
import {ExpandIcon, ExpandState, TreeItem} from '../component/Tree';
import {PureDataRenderer} from '../component/DataRenderer';
import {
  DataMap,
  ValueUpdate,
  blankFuncDesc,
  FunctionDesc,
  getFuncStyleFromDesc,
  smartStrCompare
} from '../../../src/core/editor';
import {TIcon} from '../icon/Icon';
import {ClickParam} from 'antd/lib/menu';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext';

export class NodeTreeItem extends TreeItem<NodeTreeItem> {
  childPrefix: string;
  name: string;
  isRootJob: boolean = false;

  max: number = 32;

  constructor(name: string, public id: string, parent?: NodeTreeItem, public editable = false) {
    super(parent);
    if (parent) {
      this.key = `${parent.childPrefix}${name}`;
      this.childPrefix = `${this.key}.`;
      this.name = name;
      this.isRootJob = parent.childPrefix === '';
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
    this.opened = 'loading';
    this.listingId = this.connection.listChildren(this.key, null, this.max, this) as string;
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

  onChildrenChange(parentPath: string, isHidden = false) {
    isHidden = isHidden || this.opened === 'closed';
    if (parentPath === this.key) {
      if (isHidden) {
        this.children = null;
      } else {
        this.open();
      }
    } else if (this.children && parentPath.startsWith(this.key)) {
      for (let child of this.children) {
        child.onChildrenChange(parentPath, isHidden);
      }
    }
  }

  // on children update
  onUpdate(response: DataMap): void {
    let previousChildren = new Map<string, NodeTreeItem>();
    if (this.children) {
      for (let child of this.children) {
        previousChildren.set(child.name, child);
      }
    }
    this.children = [];
    if (this.listingId) {
      this.listingId = null;
    }
    let children: DataMap = response.children;
    let names = Object.keys(children);
    names.sort(smartStrCompare);
    for (let key of names) {
      let data = children[key];
      if (previousChildren.get(key)?.id === data.id) {
        this.children.push(previousChildren.get(key));
        previousChildren.delete(key);
      } else {
        this.children.push(new NodeTreeItem(key, data.id, this, data.editable));
      }
    }
    this.opened = 'opened';
    if (this.onListChange) {
      this.onListChange();
    }
    for (let [, child] of previousChildren) {
      child.destroy();
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
  selected: boolean;
  onClick: (item: NodeTreeItem, event: React.MouseEvent) => void;
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

  onOpenClicked = () => {
    const {item} = this.props;
    if (this.context && this.context.editJob) {
      this.context.editJob(
        item.key,
        item.editable
          ? () => {
              item.getConn().applyJobChange(item.key);
            }
          : null
      );
    }
  };
  onSaveClicked = () => {
    let {item} = this.props;
    item.getConn().applyJobChange(item.key);
  };
  onDeleteClicked = () => {
    let {item} = this.props;
    item.getConn().setValue(item.key, undefined);
    item.parent?.open();
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

  onClickContent = (e: React.MouseEvent) => {
    this.props.onClick(this.props.item, e);
  };

  getMenu = () => {
    let {item} = this.props;
    let editJob = this.context && this.context.editJob;
    return (
      <Menu selectable={false}>
        {editJob ? (
          <Menu.Item onClick={this.onOpenClicked}>
            <BuildIcon />
            Open
          </Menu.Item>
        ) : null}
        {item.editable ? (
          <Menu.Item onClick={this.onSaveClicked}>
            <SaveIcon />
            Save
          </Menu.Item>
        ) : null}
        {item.editable || !item.isRootJob ? (
          <Menu.Item onClick={this.onDeleteClicked}>
            <DeleteIcon />
            Delete
          </Menu.Item>
        ) : null}
        <Menu.Item>
          <SearchIcon />
          Search
        </Menu.Item>
      </Menu>
    );
  };

  renderImpl() {
    let {item, style, selected} = this.props;
    let marginLeft = item.level * 20;
    let contentClassName = 'ticl-tree-node-content';
    if (selected) {
      contentClassName += ' ticl-tree-node-selected';
    }
    return (
      <div style={{...style, marginLeft}} className="ticl-tree-node">
        <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
        <Dropdown overlay={this.getMenu} trigger={['contextMenu']}>
          <div className={contentClassName} onClick={this.onClickContent}>
            <TIcon icon={this.desc.icon} style={getFuncStyleFromDesc(this.desc, 'tico-pr')} />
            <div className="ticl-tree-node-text">{item.name}</div>
          </div>
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
