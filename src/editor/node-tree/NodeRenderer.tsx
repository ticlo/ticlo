import React from 'react';

import {Dropdown, Button, Input, Menu, InputNumber} from 'antd';
import BuildIcon from '@ant-design/icons/BuildOutlined';
import SaveIcon from '@ant-design/icons/SaveOutlined';
import DeleteIcon from '@ant-design/icons/DeleteOutlined';
import SearchIcon from '@ant-design/icons/SearchOutlined';
import FileIcon from '@ant-design/icons/FileOutlined';
import FileExclamationIcon from '@ant-design/icons/FileTextOutlined';
import GlobalIcon from '@ant-design/icons/GlobalOutlined';
import {ExpandIcon, ExpandState, TreeItem} from '../component/Tree';
import {PureDataRenderer} from '../component/DataRenderer';
import {
  DataMap,
  ValueUpdate,
  blankFuncDesc,
  FunctionDesc,
  smartStrCompare,
  ValueSubscriber,
  getOutputDesc,
  getDisplayName,
} from '../../../src/core/editor';
import {TIcon} from '../icon/Icon';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext';
import {DragDropDiv, DragState} from 'rc-dock/lib';
import {getFuncStyleFromDesc} from '../util/BlockColors';
import {t} from '../component/LocalizedLabel';

const saveAllowed = new Set<string>(['flow:editor', 'flow:worker', 'flow:main']);
const deleteAllowed = new Set<string>(['flow:editor', 'flow:main']);

export class NodeTreeItem extends TreeItem<NodeTreeItem> {
  childPrefix: string;
  name: string;

  // updated by the renderer
  functionId: string;

  max: number = 32;

  constructor(name: string, public id: string, parent?: NodeTreeItem, public canApply = false) {
    super(parent);
    if (parent) {
      this.key = `${parent.childPrefix}${name}`;
      this.childPrefix = `${this.key}.`;
      this.name = name;
    } else {
      if (name) {
        this.key = name;
        this.childPrefix = `${name}.`;
        this.name = name.substr(name.indexOf('.') + 1);
      } else {
        // root element;
        this.key = '';
        this.childPrefix = '';
        this.name = 'Root';
      }
    }
  }

  addToList(list: NodeTreeItem[]) {
    super.addToList(list);
    // TODO add 3 dots to indicate there are mroe
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

  onChildrenChange(parentPath: string, isHidden = false, autoOpen = false) {
    isHidden = isHidden || (this.opened === 'closed' && !autoOpen);
    if (parentPath === this.key) {
      if (isHidden) {
        this.children = null;
      } else {
        this.open();
      }
    } else if (this.children && parentPath.startsWith(this.key)) {
      for (let child of this.children) {
        child.onChildrenChange(parentPath, isHidden, autoOpen);
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
        this.children.push(new NodeTreeItem(key, data.id, this, data.canApply));
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
  getMenu: (item: NodeTreeItem) => React.ReactElement[];
}
interface State {
  displayName?: string;
  hasChange: boolean;
  desc: FunctionDesc;
  error?: string;
}

export class NodeTreeRenderer extends PureDataRenderer<Props, any> {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  state: State = {hasChange: false, desc: blankFuncDesc};

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
    if (this.context && this.context.editFlow) {
      this.context.editFlow(
        item.key,
        item.canApply
          ? () => {
              item.getConn().applyFlowChange(item.key);
            }
          : null
      );
    }
  };
  onSaveClicked = () => {
    let {item} = this.props;
    item.getConn().applyFlowChange(item.key);
  };
  onDeleteClicked = () => {
    let {item} = this.props;
    item.getConn().setValue(item.key, undefined);
    item.parent?.open();
  };

  onDragStart = (e: DragState) => {
    let {item} = this.props;
    let {desc} = this.state;
    let data: any = {path: item.key};
    if (getOutputDesc(desc)) {
      data = {...data, fields: [`${item.key}.#output`]};
    }
    e.setData(data, item.getBaseConn());
    e.startDrag();
  };

  subscriptionListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let {item} = this.props;
      item.functionId = response.cache.value;
      if (typeof item.functionId === 'string') {
        item.connection.watchDesc(item.functionId, this.descCallback);
      } else {
        item.connection.unwatchDesc(this.descCallback);
        this.safeSetState({desc: blankFuncDesc});
      }
    },
  });

  hasChangeListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      this.safeSetState({hasChange: Boolean(response.cache.value)});
    },
  });

  nameListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let {value} = response.cache;
      if (typeof value === 'string') {
        this.safeSetState({displayName: value});
      } else {
        this.safeSetState({displayName: null});
      }
    },
  });

  constructor(props: Props) {
    super(props);
    let {item} = props;
    this.subscriptionListener.subscribe(item.connection, `${item.key}.#is`, true);
    this.nameListener.subscribe(item.connection, `${item.key}.@b-name`);
    if (item.canApply) {
      this.hasChangeListener.subscribe(item.connection, `${item.key}.@has-change`);
    }
  }

  descCallback = (desc: FunctionDesc) => {
    desc = desc || blankFuncDesc;
    if (desc !== this.state.desc) {
      this.safeSetState({desc});
    } else {
      this.forceUpdate();
    }
  };

  onClickContent = (e: React.MouseEvent) => {
    this.props.onClick(this.props.item, e);
  };

  getMenu = () => {
    let {item, getMenu} = this.props;
    let editFlow = this.context && this.context.editFlow;
    let menuitems: React.ReactElement[] = [];
    if (editFlow) {
      menuitems.push(
        <Menu.Item key="open" onClick={this.onOpenClicked}>
          <BuildIcon />
          {t('Open')}
        </Menu.Item>
      );
    }
    if (item.canApply) {
      menuitems.push(
        <Menu.Item key="save" onClick={this.onSaveClicked}>
          <SaveIcon />
          {t('Save')}
        </Menu.Item>
      );
    }
    if (deleteAllowed.has(item.functionId)) {
      menuitems.push(
        <Menu.Item key="delete" onClick={this.onDeleteClicked}>
          <DeleteIcon />
          {t('Delete')}
        </Menu.Item>
      );
    }
    menuitems.push(
      <Menu.Item key="search">
        <SearchIcon />
        {t('Search')}
      </Menu.Item>
    );
    if (getMenu) {
      menuitems = menuitems.concat(getMenu(item));
    }
    return <Menu selectable={false}>{menuitems}</Menu>;
  };

  renderImpl() {
    let {item, style, selected} = this.props;
    let {hasChange, displayName, desc, error} = this.state;
    let marginLeft = item.level * 20;
    let contentClassName = 'ticl-tree-node-content';
    if (selected) {
      contentClassName += ' ticl-tree-node-selected';
    }
    let icon: React.ReactElement;
    if (saveAllowed.has(item.functionId)) {
      if (hasChange) {
        icon = <FileExclamationIcon />;
      } else {
        icon = <FileIcon />;
      }
    } else if (item.functionId === 'flow:const') {
      icon = <GlobalIcon />;
    } else {
      let [colorClass, iconName] = getFuncStyleFromDesc(desc, item.getConn(), 'ticl-bg--');
      icon = <TIcon icon={iconName} colorClass={colorClass} />;
    }
    displayName = getDisplayName(item.name, displayName);
    let name: React.ReactElement;
    if (displayName === item.name) {
      name = <div className="ticl-tree-node-text">{item.name}</div>;
    } else {
      name = (
        <div className="ticl-tree-node-text ticl-tree-node-display" title={item.name}>
          {displayName}
        </div>
      );
    }
    return (
      <div style={{...style, marginLeft}} className="ticl-tree-node">
        <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
        <Dropdown overlay={this.getMenu} trigger={['contextMenu']}>
          <DragDropDiv className={contentClassName} onClick={this.onClickContent} onDragStartT={this.onDragStart}>
            {icon}
            {name}
          </DragDropDiv>
        </Dropdown>
      </div>
    );
  }

  componentWillUnmount() {
    let {item} = this.props;
    this.subscriptionListener.unsubscribe();
    this.nameListener.unsubscribe();
    this.hasChangeListener.unsubscribe();
    item.connection.unwatchDesc(this.descCallback);
    super.componentWillUnmount();
  }
}
