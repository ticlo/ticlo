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

import {ExpandIcon, ExpandState, TreeItem} from '../component/Tree.tsx';
import {PureDataRenderer} from '../component/DataRenderer.ts';
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
} from '@ticlo/core/editor.ts';
import {TIcon} from '../icon/Icon.tsx';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext.ts';
import {DragDrop, DragState} from 'rc-dock';
import {getFuncStyleFromDesc} from '../util/BlockColors.ts';
import {LocalizedNodeName, t} from '../component/LocalizedLabel.tsx';
import {BlockDropdown} from '../popup/BlockDropdown.tsx';
import {showModal} from '../popup/ShowModal.tsx';
import {AddNewFlowDialog} from '../popup/AddNewFlowDialog.tsx';
import {getDescLib, getFuncLibPath} from '../util/FunctionLib.ts';
import {requestCallbacks} from '../util/RequestCallbacks.ts';

import {MenuItem} from '../component/ClickPopup.tsx';
import {LazyUpdateSubscriber} from '../component/LazyUpdateComponent.tsx';

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
const addFolderAllowed = ['flow:folder', 'flow:namespace'];
const addLibraryAllowed = ['flow:namespace'];

export class NodeTreeItem extends TreeItem<NodeTreeItem> {
  childPrefix: string;
  name: string;
  order: unknown;
  ordered = false;

  functionId: string;
  funcLib: string;
  desc: FunctionDesc = blankFuncDesc;

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
    this.subscribe();
  }

  addToList(list: NodeTreeItem[]) {
    super.addToList(list);
    // TODO add 3 dots to indicate there are mroe
  }

  listingId: string;
  private watchingChildren = false;
  private childrenReady = false;
  private childrenListener = {
    onUpdate: () => {
      if (this.childrenReady && this.opened !== 'closed') this.open();
      this.childrenReady = true;
    },
  };

  open() {
    if (this.opened === 'loading') {
      return;
    }
    this.opened = 'loading';
    if (!this.watchingChildren) {
      this.watchingChildren = true;
      this.connection.watch(this.key, this.childrenListener);
    }
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

  subscribe() {
    if (this.connection && this.key != null) {
      this.orderListener.subscribe(this.connection, this.key ? `${this.key}.#order` : '#order', true);
      this.functionListener.subscribe(this.connection, this.key ? `${this.key}.#is` : '#is', true);
      this.scopeListener.subscribe(this.connection, this.key ? `${this.key}.#lib` : '#lib', true);
    }
  }

  watchDesc() {
    this.connection.unwatchDesc(this.descCallback);
    this.descCallback(blankFuncDesc);
    if (typeof this.functionId === 'string') {
      this.connection.watchDesc(this.functionId, getDescLib(this.functionId, this.funcLib), this.descCallback);
    }
  }

  functionListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      this.functionId = response.cache.value;
      this.watchDesc();
    },
  });

  scopeListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      const nextScope = getFuncLibPath(response.cache.value);
      if (nextScope !== this.funcLib) {
        this.funcLib = nextScope;
        this.watchDesc();
      }
    },
  });

  descCallback = (desc: FunctionDesc) => {
    this.desc = desc || blankFuncDesc;
    for (const renderer of this._renderers) renderer.descCallback(this.desc);
  };

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
    if (this.watchingChildren) this.connection.unwatch(this.key, this.childrenListener);
    this.orderListener.unsubscribe();
    this.functionListener.unsubscribe();
    this.scopeListener.unsubscribe();
    this.connection?.unwatchDesc(this.descCallback);
    super.destroy();
  }
}

export interface NodeTreeFunctionDrag {
  data: DataMap;
  desc: FunctionDesc;
  name: string;
}

interface Props {
  item: NodeTreeItem;
  style: React.CSSProperties;
  selected: boolean;
  onClick: (item: NodeTreeItem, event: React.MouseEvent) => void;
  getOrderedDrag?: (item: NodeTreeItem) => NodeTreeItem[];
  canDropOrdered?: (items: NodeTreeItem[], target: NodeTreeItem, index?: number) => boolean;
  onDropOrdered?: (items: NodeTreeItem[], target: NodeTreeItem, index?: number) => void;
  canDropFunction?: (drag: NodeTreeFunctionDrag, target: NodeTreeItem, index?: number) => boolean;
  onDropFunction?: (drag: NodeTreeFunctionDrag, target: NodeTreeItem, index?: number) => void;
}

interface State {
  desc: FunctionDesc;
  error?: string;
  dropPosition?: 'before' | 'after' | 'inside';
}

export class NodeTreeRenderer extends PureDataRenderer<Props, any> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  state: State = {desc: blankFuncDesc};
  dropRef = React.createRef<HTMLDivElement>();

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
              item.getConn().applyFlowChange(item.key, undefined, requestCallbacks);
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
    const orderedItems = this.props.getOrderedDrag?.(item);
    if (orderedItems) data.orderedItems = orderedItems;
    e.setData(data, item.getBaseConn());
    const preview = e.component.element.cloneNode(true) as HTMLElement;
    preview.style.width = 'max-content';
    preview.style.maxWidth = `${Math.min(e.component.element.offsetWidth, 400)}px`;
    e.startDrag(undefined, preview, {opacity: 0.9});
  };

  getDrop(e: DragState) {
    const {item, canDropOrdered, canDropFunction} = this.props;
    const items: NodeTreeItem[] = DragState.getData('orderedItems', item.getBaseConn());
    const data: DataMap = DragState.getData('blockData', item.getBaseConn());
    const desc: FunctionDesc = DragState.getData('functionDesc', item.getBaseConn());
    if (!items?.length && !(data && desc)) return;
    const rect = this.dropRef.current.getBoundingClientRect();
    const offset = (e.clientY - rect.top) / rect.height;
    let position: State['dropPosition'] = 'inside';
    let target = item;
    let index: number;
    if (item.ordered && item.parent && (offset < 0.25 || offset > 0.75)) {
      position = offset < 0.25 ? 'before' : 'after';
      target = item.parent;
      index = (target.order as string[]).indexOf(item.name) + (position === 'after' ? 1 : 0);
    }
    if (items?.length && canDropOrdered?.(items, target, index)) return {items, target, index, position};
    if (data && desc) {
      const name = (DragState.getData('blockName', item.getBaseConn()) || desc.name || desc.id).split('.').pop();
      const functionDrag = {data, desc, name};
      if (canDropFunction?.(functionDrag, target, index)) return {functionDrag, target, index, position};
    }
  }

  onDragOver = (e: DragState) => {
    const drop = this.getDrop(e);
    if (drop) e.accept(drop.functionDrag ? 'tico-fas-plus' : 'tico-fas-exchange-alt');
    this.safeSetState({dropPosition: drop?.position});
  };

  onDragLeave = () => this.safeSetState({dropPosition: undefined});

  onDrop = (e: DragState) => {
    const drop = this.getDrop(e);
    this.onDragLeave();
    if (drop?.functionDrag) this.props.onDropFunction?.(drop.functionDrag, drop.target, drop.index);
    else if (drop) this.props.onDropOrdered?.(drop.items, drop.target, drop.index);
  };

  disabledListener = new LazyUpdateSubscriber(this);
  hasChangeListener = new LazyUpdateSubscriber(this);
  nameListener = new LazyUpdateSubscriber(this);
  styleListener = new LazyUpdateSubscriber(this);

  componentDidMount() {
    super.componentDidMount();
    this.subscribeValues();
  }

  componentDidUpdate(previous: Props) {
    super.componentDidUpdate(previous);
    if (previous.item !== this.props.item) {
      this.unsubscribeValues();
      this.subscribeValues();
    }
  }

  subscribeValues() {
    const {item} = this.props;
    this.descCallback(item.desc);
    this.disabledListener.subscribe(item.connection, `${item.key}.#disabled`, true);
    this.nameListener.subscribe(item.connection, `${item.key}.@b-name`);
    if (item.canApply) {
      this.hasChangeListener.subscribe(item.connection, `${item.key}.@has-change`);
    }
  }

  descCallback = (desc: FunctionDesc) => {
    desc = desc || blankFuncDesc;
    this.safeSetState({desc});
    if (desc.dynamicStyle) {
      const {item} = this.props;
      this.styleListener.subscribe(item.connection, `${item.key}.@b-style`, true);
    } else {
      this.styleListener.unsubscribe();
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
    if (this.state.dropPosition === 'inside') contentClassName += ' ticl-tree-drop-inside';
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
    if (this.state.dropPosition === 'before' || this.state.dropPosition === 'after') {
      nodeClassName += ` ticl-tree-drop-${this.state.dropPosition}`;
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
          funcLib={item.funcLib}
        >
          <DragDrop
            ref={this.dropRef}
            className={contentClassName}
            onClick={this.onClickContent}
            onDragStartT={this.onDragStart}
            onDragOverT={this.onDragOver}
            onDragLeaveT={this.onDragLeave}
            onDropT={this.onDrop}
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

  unsubscribeValues() {
    this.disabledListener.unsubscribe();
    this.nameListener.unsubscribe();
    this.hasChangeListener.unsubscribe();
    this.styleListener.unsubscribe();
  }

  componentWillUnmount() {
    this.unsubscribeValues();
    super.componentWillUnmount();
  }
}
