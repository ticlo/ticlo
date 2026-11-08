import React from 'react';

import {
  BuildOutlined,
  CheckOutlined,
  DeleteOutlined,
  FileAddOutlined,
  FileFilled,
  FileOutlined,
  FileTextFilled,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOpenFilled,
  GlobalOutlined,
  PauseCircleOutlined,
  ProfileOutlined,
  SaveOutlined,
  SearchOutlined,
  WalletOutlined,
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
  isStringArray,
} from '@ticlo/core/editor.ts';
import {TIcon} from '../icon/Icon.tsx';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext.ts';
import {DragDrop, DragState} from 'rc-dock';
import {getFuncStyleFromDesc} from '../util/BlockColors.ts';
import {LocalizedNodeName, t} from '../component/LocalizedLabel.tsx';
import {BlockDropdown} from '../popup/BlockDropdown.tsx';
import {showModal} from '../popup/ShowModal.tsx';
import {AddNewFlowDialog} from '../popup/AddNewFlowDialog.tsx';
import {getDescModule, getFuncModulePath} from '../util/FunctionModule.ts';
import {requestCallbacks} from '../util/RequestCallbacks.ts';

import {MenuItem} from '../component/ClickPopup.tsx';
import {LazyUpdateSubscriber} from '../component/LazyUpdateComponent.tsx';

const saveAllowed = new Set<string>(['flow:editor', 'flow:worker', 'flow:main', 'flow:context', 'flow:test-case']);
const quickOpenAllowed = new Set<string>([
  'group',
  'flow:editor',
  'flow:worker',
  'flow:main',
  'flow:context',
  'flow:test-case',
  'flow:const',
  'flow:global',
]);
const addFlowAllowed = ['flow:folder', 'flow:test-group', 'flow:library'];
const addFolderAllowed = ['flow:folder', 'flow:library'];
const addModuleAllowed = ['flow:library'];

export class NodeTreeItem extends TreeItem<NodeTreeItem> {
  childPrefix: string;
  name: string;
  order: unknown;
  ordered = false;

  functionId: string;
  funcModule: string;
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

  addToList(list: NodeTreeItem[], tags?: readonly string[]) {
    if (this.level >= 0) {
      if (tags && !this.desc.tags?.some((tag) => tags.includes(tag))) return;
      list.push(this);
    }
    if (this.opened === 'opened' && this.children) {
      for (const child of this.children) child.addToList(list, tags);
    }
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
      this.scopeListener.subscribe(this.connection, this.key ? `${this.key}.#module` : '#module', true);
    }
  }

  watchDesc() {
    this.connection.unwatchDesc(this.descCallback);
    this.descCallback(blankFuncDesc);
    if (typeof this.functionId === 'string') {
      this.connection.watchDesc(this.functionId, getDescModule(this.functionId, this.funcModule), this.descCallback);
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
      const nextScope = getFuncModulePath(response.cache.value);
      if (nextScope !== this.funcModule) {
        this.funcModule = nextScope;
        this.watchDesc();
      }
    },
  });

  descCallback = (desc: FunctionDesc) => {
    this.desc = desc || blankFuncDesc;
    for (const renderer of this._renderers) renderer.descCallback(this.desc);
    this.onListChange?.();
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
    if (isStringArray(this.order)) {
      for (const name of this.order) {
        const child = children.get(name);
        if (child) {
          orderedChildren.push(child);
          orderedNames.add(name);
          children.delete(name);
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

export interface NodeTreeOpenAction {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onOpen: (path: string, onSave: () => void) => void;
  functionIds?: readonly string[];
}

export interface ModuleAutoLoad {
  get: (path: string) => Promise<boolean>;
  set: (path: string, enabled: boolean) => Promise<void>;
}

interface Props {
  item: NodeTreeItem;
  style: React.CSSProperties;
  selected: boolean;
  onClick: (item: NodeTreeItem, event: React.MouseEvent) => void;
  openActions?: readonly NodeTreeOpenAction[];
  moduleAutoLoad?: ModuleAutoLoad;
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
  autoLoad?: boolean;
  canAutoLoad?: boolean;
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

  getOpenActions = (): readonly NodeTreeOpenAction[] => {
    if (this.props.openActions) {
      return this.props.openActions.filter(
        (action) => !action.functionIds || action.functionIds.includes(this.props.item.functionId)
      );
    }
    return this.context?.editFlow
      ? [{key: 'open-flow', label: t('Open Flow'), icon: <BuildOutlined />, onOpen: this.context.editFlow}]
      : [];
  };

  openBlock = (action: NodeTreeOpenAction) => {
    const {item} = this.props;
    if (action) {
      action.onOpen(
        item.key,
        item.canApply
          ? () => {
              item.getConn().applyFlowChange(item.key, undefined, requestCallbacks);
            }
          : null
      );
    }
  };

  onOpenBlock = () => this.openBlock(this.getOpenActions()[0]);

  onAddFlowClick = (path: string) => {
    const {item} = this.props;
    showModal(<AddNewFlowDialog conn={item.getConn()} basePath={`${path}.`} />, this.context.showModal);
  };
  onAddFolderClick = (path: string) => {
    const {item} = this.props;
    showModal(<AddNewFlowDialog conn={item.getConn()} basePath={`${path}.`} isFolder={true} />, this.context.showModal);
  };
  onAddModuleClick = (path: string) => {
    const {item} = this.props;
    showModal(<AddNewFlowDialog conn={item.getConn()} basePath={`${path}.:`} />, this.context.showModal);
  };

  autoLoadRequest = 0;
  autoLoadItem?: NodeTreeItem;
  autoLoadFunctionId?: string;
  autoLoadProvider?: ModuleAutoLoad;
  syncAutoLoad = () => {
    const {item, moduleAutoLoad} = this.props;
    if (
      this.autoLoadItem === item &&
      this.autoLoadFunctionId === item.functionId &&
      this.autoLoadProvider === moduleAutoLoad
    )
      return;
    this.autoLoadItem = item;
    this.autoLoadFunctionId = item.functionId;
    this.autoLoadProvider = moduleAutoLoad;
    ++this.autoLoadRequest;
    if (item.functionId !== 'flow:main' && (item.functionId !== 'flow:module' || !moduleAutoLoad)) {
      if (this.state.autoLoad !== undefined || this.state.canAutoLoad !== undefined) {
        this.safeSetState({autoLoad: undefined, canAutoLoad: undefined});
      }
      return;
    }
    this.safeSetState({autoLoad: undefined, canAutoLoad: undefined});
    void this.readAutoLoad();
  };

  readAutoLoad = async () => {
    const {item, moduleAutoLoad} = this.props;
    if (item.functionId !== 'flow:main' && (item.functionId !== 'flow:module' || !moduleAutoLoad)) return;
    const request = ++this.autoLoadRequest;
    try {
      if (item.functionId === 'flow:main') {
        const {autoLoad, canAutoLoad} = await item.getConn().getAutoLoadFlow(item.key);
        if (request === this.autoLoadRequest) this.safeSetState({autoLoad, canAutoLoad});
      } else {
        const autoLoad = await moduleAutoLoad.get(item.key);
        if (request === this.autoLoadRequest) this.safeSetState({autoLoad});
      }
    } catch (error) {
      requestCallbacks.onError(String(error));
    }
  };

  toggleAutoLoad = async () => {
    const {item, moduleAutoLoad} = this.props;
    ++this.autoLoadRequest;
    try {
      if (item.functionId === 'flow:main') {
        const conn = item.getConn();
        const autoLoad = !(this.state.autoLoad ?? (await conn.getAutoLoadFlow(item.key)).autoLoad);
        await conn.setAutoLoadFlow(item.key, autoLoad);
        this.safeSetState({autoLoad});
        conn.childrenChangeStream().dispatch({path: item.parent?.key ?? ''});
        return;
      }
      if (!moduleAutoLoad) return;
      const autoLoad = !(this.state.autoLoad ?? (await moduleAutoLoad.get(item.key)));
      await moduleAutoLoad.set(item.key, autoLoad);
      this.safeSetState({autoLoad});
    } catch (error) {
      requestCallbacks.onError(String(error));
    }
  };

  getMenu = () => {
    const {item} = this.props;

    const menuItems: React.ReactElement[] = [];

    for (const action of this.getOpenActions()) {
      menuItems.push(
        <MenuItem key={action.key} onClick={() => this.openBlock(action)}>
          {action.icon}
          {action.label}
        </MenuItem>
      );
    }
    if (item.functionId === 'flow:module' && this.props.moduleAutoLoad) {
      menuItems.push(
        <MenuItem key="autoLoad" onClick={() => void this.toggleAutoLoad()}>
          <CheckOutlined style={{visibility: this.state.autoLoad ? 'visible' : 'hidden'}} />
          {t('Auto Load')}
        </MenuItem>
      );
    }
    if (item.functionId === 'flow:main' && this.state.canAutoLoad) {
      menuItems.push(
        <MenuItem key="autoLoadFlow" onClick={() => void this.toggleAutoLoad()}>
          <CheckOutlined style={{visibility: this.state.autoLoad ? 'visible' : 'hidden'}} />
          {t('Auto Load')}
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
    if (addModuleAllowed.includes(item.functionId)) {
      menuItems.push(
        <MenuItem key="addModule" value={item.key} onClick={this.onAddModuleClick}>
          <FileAddOutlined />
          {t('Add Module')}
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
    if (drop) e.accept(drop.functionDrag ? 'tico-txt-plus' : 'tico-svg-right-left');
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
    this.syncAutoLoad();
  }

  subscribeValues() {
    const {item} = this.props;
    this.descCallback(item.desc);
    this.disabledListener.subscribe(item.connection, `${item.key}.#disabled`, true);
    this.nameListener.subscribe(item.connection, `${item.key}.#label`);
    if (item.canApply) {
      this.hasChangeListener.subscribe(item.connection, `${item.key}.@has-change`);
    }
  }

  descCallback = (desc: FunctionDesc) => {
    desc = desc || blankFuncDesc;
    this.safeSetState({desc});
    this.syncAutoLoad();
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
    let contentClassName = 'ticl-e-tree-node-content';
    if (selected) {
      contentClassName += ' ticl-e-tree-node-selected';
    }
    if (this.state.dropPosition === 'inside') contentClassName += ' ticl-e-tree-drop-inside';
    let icon: React.ReactElement;

    let [colorStyle, iconName] = getFuncStyleFromDesc(desc, item.getConn());

    if (dynamicStyle) {
      const [dynamicColor, dynamicIcon] = getFuncStyleFromDesc(dynamicStyle, null);
      colorStyle = dynamicColor;
      if (dynamicIcon) {
        iconName = dynamicIcon;
      }
    }
    icon = <TIcon icon={iconName} style={colorStyle} />;

    if (!dynamicStyle) {
      if (item.functionId === 'flow:context') {
        icon = <ProfileOutlined />;
      } else if (saveAllowed.has(item.functionId)) {
        if (this.hasChangeListener.value) {
          icon = item.functionId === 'flow:main' && this.state.autoLoad ? <FileTextFilled /> : <FileTextOutlined />;
        } else {
          icon = item.functionId === 'flow:main' && this.state.autoLoad ? <FileFilled /> : <FileOutlined />;
        }
      } else if (item.functionId === 'flow:const' || item.functionId === 'flow:global') {
        icon = <GlobalOutlined />;
      } else if (item.functionId === 'flow:folder') {
        icon = <FolderOpenOutlined />;
      } else if (item.functionId === 'flow:library') {
        icon = <FolderOpenFilled />;
      } else if (item.functionId === 'flow:module') {
        icon = <WalletOutlined />;
      }
    }

    let nameLabel: string | React.ReactNode = getDisplayName(item.name, displayName);
    if (item.name.startsWith('#') || (nameLabel as string).endsWith('-#')) {
      nameLabel = <LocalizedNodeName name={nameLabel as string} options={dynamicStyle} />;
    }
    let nameNode: React.ReactElement;
    if (nameLabel === item.name) {
      nameNode = <div className="ticl-e-tree-node-text">{item.name}</div>;
    } else {
      // display element title to show the real name
      nameNode = (
        <div className="ticl-e-tree-node-text ticl-e-tree-node-display" title={item.name}>
          {nameLabel}
        </div>
      );
    }
    const onDoubleClick =
      this.getOpenActions().length && (this.props.openActions !== undefined || quickOpenAllowed.has(item.functionId))
        ? this.onOpenBlock
        : null;

    let disabled = this.disabledListener.value;
    if (disabled == null && saveAllowed.has(item.functionId)) {
      // Force the DropDown to show the disable menu by not giving it null value
      disabled = false;
    }
    let nodeClassName = 'ticl-e-tree-node';
    if (item.ordered) {
      nodeClassName += ' ticl-e-tree-node-ordered';
    }
    if (this.state.dropPosition === 'before' || this.state.dropPosition === 'after') {
      nodeClassName += ` ticl-e-tree-drop-${this.state.dropPosition}`;
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
          menuVersion={item.functionId === 'flow:main' && !this.state.canAutoLoad ? undefined : this.state.autoLoad}
          onMenuOpen={this.readAutoLoad}
          disabled={disabled}
          funcModule={item.funcModule}
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
    ++this.autoLoadRequest;
    this.unsubscribeValues();
    super.componentWillUnmount();
  }
}
