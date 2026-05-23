import React from 'react';

import {
  BookFilled,
  BuildOutlined,
  DeleteOutlined,
  FileAddOutlined,
  FileOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOpenFilled,
  GlobalOutlined,
  PauseCircleOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';

import {ExpandIcon, ExpandState, TreeItem} from '../component/Tree.js';
import {PureDataRenderer} from '../component/DataRenderer.js';
import {
  DataMap,
  ValueUpdate,
  blankFuncDesc,
  FunctionDesc,
  smartStrCompare,
  ValueSubscriber,
  getOutputDesc,
  getDisplayName,
  deepEqual,
  ClientConn,
} from '@ticlo/core/editor.js';
import {TIcon} from '../icon/Icon.js';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext.js';
import {DragDrop, DragState} from 'rc-dock';
import {getFuncStyleFromDesc} from '../util/BlockColors.js';
import {LocalizedNodeName, t} from '../component/LocalizedLabel.js';
import {BlockDropdown} from '../popup/BlockDropdown.js';
import {showModal} from '../popup/ShowModal.js';
import {AddNewFlowDialog} from '../popup/AddNewFlowDialog.js';
import {getDescLib, getFuncLibPath} from '../util/FunctionLib.js';

import {MenuItem} from '../component/ClickPopup.js';
import {LazyUpdateSubscriber} from '../component/LazyUpdateComponent.js';

const saveAllowed = new Set<string>(['flow:editor', 'flow:worker', 'flow:main', 'flow:test-case']);
const quickOpenAllowed = new Set<string>([
  'group',
  'flow:editor',
  'flow:worker',
  'flow:main',
  'flow:test-case',
  'flow:const',
  'flow:global',
]);
const addFlowAllowed = ['flow:folder', 'flow:test-group', 'flow:namespace'];
const addFolderAllowed = ['flow:folder'];
const addLibraryAllowed = ['flow:namespace'];

export class NodeTreeItem extends TreeItem<NodeTreeItem> {
  childPrefix: string;
  name: string;
  order: unknown;
  ordered = false;

  // updated by the renderer
  functionId: string;

  max: number = 32;

  constructor(
    name: string,
    public id: string,
    parent?: NodeTreeItem,
    public canApply = false
  ) {
    super(parent);
    if (parent) {
      this.key = `${parent.childPrefix}${name}`;
      this.childPrefix = `${this.key}.`;
      this.name = name;
    } else {
      if (name) {
        this.key = name;
        this.childPrefix = `${name}.`;
        this.name = name.substring(name.indexOf('.') + 1);
      } else {
        // root element;
        this.key = '';
        this.childPrefix = '';
        this.name = 'Root';
      }
    }
    this.subscribeOrder();
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
    this.listingId = this.connection.list(this.key, null, this.max, this) as string;
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
        this.destroyChildren();
      } else {
        this.open();
      }
    } else if (this.children && parentPath.startsWith(this.key)) {
      for (const child of this.children) {
        child.onChildrenChange(parentPath, isHidden, autoOpen);
      }
    }
  }

  // on children update
  onUpdate(response: DataMap): void {
    const previousChildren = new Map<string, NodeTreeItem>();
    if (this.children) {
      for (const child of this.children) {
        previousChildren.set(child.name, child);
      }
    }
    this.children = [];
    if (this.listingId) {
      this.listingId = null;
    }
    const children = response.children as DataMap;
    const names = Object.keys(children);
    names.sort(smartStrCompare);
    for (const key of names) {
      const data = children[key] as DataMap;
      if (previousChildren.get(key)?.id === data.id) {
        this.children.push(previousChildren.get(key));
        previousChildren.delete(key);
      } else {
        this.children.push(new NodeTreeItem(key, data.id?.toString(), this, Boolean(data.canApply)));
      }
    }
    this.applyOrder();
    this.opened = 'opened';
    if (this.onListChange) {
      this.onListChange();
    }
    for (const [, child] of previousChildren) {
      child.destroy();
    }
    this.forceUpdate();
  }

  orderListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      const order = response.cache.value;
      if (!deepEqual(order, this.order)) {
        this.order = order;
        if (this.children) {
          this.applyOrder();
          if (this.onListChange) {
            this.onListChange();
          }
          this.forceUpdate();
        }
      }
    },
  });

  subscribeOrder() {
    if (this.connection && this.key != null) {
      this.orderListener.subscribe(this.connection, this.key ? `${this.key}.#order` : '#order', true);
    }
  }

  applyOrder() {
    if (!this.children) {
      return;
    }
    const children = new Map<string, NodeTreeItem>();
    for (const child of this.children) {
      children.set(child.name, child);
    }
    const orderedChildren: NodeTreeItem[] = [];
    const orderedNames = new Set<string>();
    if (Array.isArray(this.order)) {
      for (const name of this.order) {
        if (typeof name === 'string') {
          const child = children.get(name);
          if (child) {
            orderedChildren.push(child);
            orderedNames.add(name);
            children.delete(name);
          }
        }
      }
    }
    for (const child of this.children) {
      const ordered = orderedNames.has(child.name);
      if (child.ordered !== ordered) {
        child.ordered = ordered;
        child.forceUpdate();
      }
    }
    const otherChildren = Array.from(children.values());
    otherChildren.sort((a, b) => smartStrCompare(a.name, b.name));
    this.children = orderedChildren.concat(otherChildren);
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
    this.orderListener.unsubscribe();
    super.destroy();
  }
}

interface Props {
  item: NodeTreeItem;
  style: React.CSSProperties;
  selected: boolean;
  onClick: (item: NodeTreeItem, event: React.MouseEvent) => void;
}

interface State {
  desc: FunctionDesc;
  error?: string;
}

export class NodeTreeRenderer extends PureDataRenderer<Props, any> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  state: State = {desc: blankFuncDesc};
  funcLib: string;

  onExpandClicked = () => {
    const {item} = this.props;
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

  onOpenBlock = () => {
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

  onAddFlowClick = (path: string) => {
    const {item} = this.props;
    showModal(<AddNewFlowDialog conn={item.getConn()} basePath={`${path}.`} />, this.context.showModal);
  };
  onAddFolderClick = (path: string) => {
    const {item} = this.props;
    showModal(<AddNewFlowDialog conn={item.getConn()} basePath={`${path}.`} isFolder={true} />, this.context.showModal);
  };
  onAddLibraryClick = (path: string) => {
    const {item} = this.props;
    showModal(<AddNewFlowDialog conn={item.getConn()} basePath={`${path}.:`} />, this.context.showModal);
  };

  getMenu = () => {
    const {item} = this.props;

    const menuItems: React.ReactElement[] = [];

    const editFlow = this.context?.editFlow;
    if (editFlow) {
      menuItems.push(
        <MenuItem key="open" onClick={this.onOpenBlock}>
          <BuildOutlined />
          {t('Open')}
        </MenuItem>
      );
    }
    // find the root node, so every level of parents is Flow
    if (addFlowAllowed.includes(item.functionId)) {
      menuItems.push(
        <MenuItem key="addFlow" value={item.key} onClick={this.onAddFlowClick}>
          <FileAddOutlined />
          {t('Add Dataflow')}
        </MenuItem>
      );
    }
    if (addFolderAllowed.includes(item.functionId)) {
      menuItems.push(
        <MenuItem key="addFolder" value={item.key} onClick={this.onAddFolderClick}>
          <FileAddOutlined />
          {t('Add Folder')}
        </MenuItem>
      );
    }
    if (addLibraryAllowed.includes(item.functionId)) {
      menuItems.push(
        <MenuItem key="addLibrary" value={item.key} onClick={this.onAddLibraryClick}>
          <FileAddOutlined />
          {t('Add Library')}
        </MenuItem>
      );
    }
    menuItems.push(
      <MenuItem key="search">
        <SearchOutlined />
        {t('Search')}
      </MenuItem>
    );

    return menuItems;
  };

  onDragStart = (e: DragState) => {
    const {item} = this.props;
    const {desc} = this.state;
    let data: any = {path: item.key, functionId: item.functionId};
    if (getOutputDesc(desc)) {
      data = {...data, fields: [`${item.key}.#output`]};
    }
    e.setData(data, item.getBaseConn());
    e.startDrag();
  };

  watchDesc() {
    const {item} = this.props;
    item.connection.unwatchDesc(this.descCallback);
    if (typeof item.functionId === 'string') {
      item.connection.watchDesc(item.functionId, getDescLib(item.functionId, this.funcLib), this.descCallback);
    }
  }

  subscriptionListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      const {item} = this.props;
      item.functionId = response.cache.value;
      if (typeof item.functionId === 'string') {
        this.watchDesc();
      } else {
        item.connection.unwatchDesc(this.descCallback);
        this.safeSetState({desc: blankFuncDesc});
      }
    },
  });

  scopeListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      const {item} = this.props;
      const nextScope = getFuncLibPath(response.cache.value);
      if (nextScope !== this.funcLib) {
        this.funcLib = nextScope;
        this.watchDesc();
      }
    },
  });

  disabledListener = new LazyUpdateSubscriber(this);
  hasChangeListener = new LazyUpdateSubscriber(this);
  nameListener = new LazyUpdateSubscriber(this);
  styleListener = new LazyUpdateSubscriber(this);

  constructor(props: Props) {
    super(props);
    const {item} = props;
    this.subscriptionListener.subscribe(item.connection, `${item.key}.#is`, true);
    this.scopeListener.subscribe(item.connection, `${item.key}.#lib`, true);
    this.disabledListener.subscribe(item.connection, `${item.key}.#disabled`, true);
    this.nameListener.subscribe(item.connection, `${item.key}.@b-name`);
    if (item.canApply) {
      this.hasChangeListener.subscribe(item.connection, `${item.key}.@has-change`);
    }
  }

  descCallback = (desc: FunctionDesc) => {
    desc = desc || blankFuncDesc;
    if (desc !== this.state.desc) {
      this.safeSetState({desc});
      if (desc.dynamicStyle) {
        const {item} = this.props;
        this.styleListener.subscribe(item.connection, `${item.key}.@b-style`, true);
      } else {
        this.styleListener.unsubscribe();
      }
    } else {
      this.forceUpdate();
    }
  };

  onClickContent = (e: React.MouseEvent) => {
    this.props.onClick(this.props.item, e);
  };

  renderImpl() {
    const {item, style, selected} = this.props;
    const {desc, error} = this.state;
    const dynamicStyle = this.styleListener.value;
    const displayName = this.nameListener.value;
    const marginLeft = item.level * 20;
    let contentClassName = 'ticl-tree-node-content';
    if (selected) {
      contentClassName += ' ticl-tree-node-selected';
    }
    let icon: React.ReactElement;

    let [colorClass, iconName] = getFuncStyleFromDesc(desc, item.getConn(), 'ticl-bg--');

    if (dynamicStyle) {
      const [dynamicColor, dynamicIcon] = getFuncStyleFromDesc(dynamicStyle, null, 'ticl-bg--');
      if (dynamicColor) {
        colorClass = dynamicColor;
      }
      if (dynamicIcon) {
        iconName = dynamicIcon;
      }
    }
    icon = <TIcon icon={iconName} colorClass={colorClass} />;

    if (!dynamicStyle) {
      if (saveAllowed.has(item.functionId)) {
        if (this.hasChangeListener.value) {
          icon = <FileTextOutlined />;
        } else {
          icon = <FileOutlined />;
        }
      } else if (item.functionId === 'flow:const' || item.functionId === 'flow:global') {
        icon = <GlobalOutlined />;
      } else if (item.functionId === 'flow:folder') {
        icon = <FolderOpenOutlined />;
      } else if (item.functionId === 'flow:namespace') {
        icon = <FolderOpenFilled />;
      } else if (item.functionId === 'flow:lib') {
        icon = <BookFilled />;
      }
    }

    let nameLabel: string | React.ReactNode = getDisplayName(item.name, displayName);
    if (item.name.startsWith('#') || (nameLabel as string).endsWith('-#')) {
      nameLabel = <LocalizedNodeName name={nameLabel as string} options={dynamicStyle} />;
    }
    let nameNode: React.ReactElement;
    if (nameLabel === item.name) {
      nameNode = <div className="ticl-tree-node-text">{item.name}</div>;
    } else {
      // display element title to show the real name
      nameNode = (
        <div className="ticl-tree-node-text ticl-tree-node-display" title={item.name}>
          {nameLabel}
        </div>
      );
    }
    const onDoubleClick = this.context?.editFlow && quickOpenAllowed.has(item.functionId) ? this.onOpenBlock : null;

    let disabled = this.disabledListener.value;
    if (disabled == null && saveAllowed.has(item.functionId)) {
      // Force the DropDown to show the disable menu by not giving it null value
      disabled = false;
    }
    let nodeClassName = 'ticl-tree-node';
    if (item.ordered) {
      nodeClassName += ' ticl-tree-node-ordered';
    }
    return (
      <div style={{...style, marginLeft}} className={nodeClassName}>
        <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
        <BlockDropdown
          conn={item.getConn()}
          path={item.key}
          displayName={displayName}
          functionId={item.functionId}
          canApply={item.canApply}
          getMenu={this.getMenu}
          disabled={disabled}
          funcLib={this.funcLib}
        >
          <DragDrop
            className={contentClassName}
            onClick={this.onClickContent}
            onDragStartT={this.onDragStart}
            onDoubleClick={onDoubleClick}
          >
            {icon}
            {nameNode}
            {this.disabledListener.value ? <PauseCircleOutlined /> : null}
          </DragDrop>
        </BlockDropdown>
      </div>
    );
  }

  componentWillUnmount() {
    const {item} = this.props;
    this.subscriptionListener.unsubscribe();
    this.scopeListener.unsubscribe();
    this.nameListener.unsubscribe();
    this.hasChangeListener.unsubscribe();
    item.connection.unwatchDesc(this.descCallback);
    super.componentWillUnmount();
  }
}
