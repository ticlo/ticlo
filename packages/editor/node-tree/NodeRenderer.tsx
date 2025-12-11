import React from 'react';

import BuildIcon from '@ant-design/icons/BuildOutlined';
import PauseCircleOutlined from '@ant-design/icons/PauseCircleOutlined';
import SaveIcon from '@ant-design/icons/SaveOutlined';
import DeleteIcon from '@ant-design/icons/DeleteOutlined';
import SearchIcon from '@ant-design/icons/SearchOutlined';
import FileIcon from '@ant-design/icons/FileOutlined';
import FolderIcon from '@ant-design/icons/FolderOpenOutlined';
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
  deepEqual,
  ClientConn,
} from '@ticlo/core/editor';
import {TIcon} from '../icon/Icon';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext';
import {DragDrop, DragState} from 'rc-dock';
import {getFuncStyleFromDesc} from '../util/BlockColors';
import {LocalizedNodeName, t} from '../component/LocalizedLabel';
import {BlockDropdown} from '../popup/BlockDropdown';
import {showModal} from '../popup/ShowModal';
import {AddNewFlowDialog} from '../popup/AddNewFlowDialog';
import FileAddIcon from '@ant-design/icons/FileAddOutlined';
import {MenuItem} from '../component/ClickPopup';
import {LazyUpdateSubscriber} from '../component/LazyUpdateComponent';

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
const addFlowAllowed = ['flow:folder', 'flow:test-group'];
const addFolderAllowed = ['flow:folder'];

export class NodeTreeItem extends TreeItem<NodeTreeItem> {
  childPrefix: string;
  name: string;

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
    let children = response.children as DataMap;
    let names = Object.keys(children);
    names.sort(smartStrCompare);
    for (let key of names) {
      let data = children[key] as DataMap;
      if (previousChildren.get(key)?.id === data.id) {
        this.children.push(previousChildren.get(key));
        previousChildren.delete(key);
      } else {
        this.children.push(new NodeTreeItem(key, data.id?.toString(), this, Boolean(data.canApply)));
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

interface State {
  desc: FunctionDesc;
  error?: string;
}

export class NodeTreeRenderer extends PureDataRenderer<Props, any> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  state: State = {desc: blankFuncDesc};

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
    let {item} = this.props;
    showModal(<AddNewFlowDialog conn={item.getConn()} basePath={`${path}.`} />, this.context.showModal);
  };
  onAddFolderClick = (path: string) => {
    let {item} = this.props;
    showModal(<AddNewFlowDialog conn={item.getConn()} basePath={`${path}.`} isFolder={true} />, this.context.showModal);
  };

  getMenu = () => {
    let {item} = this.props;

    let menuItems: React.ReactElement[] = [];

    let editFlow = this.context?.editFlow;
    if (editFlow) {
      menuItems.push(
        <MenuItem key="open" onClick={this.onOpenBlock}>
          <BuildIcon />
          {t('Open')}
        </MenuItem>
      );
    }
    // find the root node, so every level of parents is Flow
    if (addFlowAllowed.includes(item.functionId)) {
      menuItems.push(
        <MenuItem key="addFlow" value={item.key} onClick={this.onAddFlowClick}>
          <FileAddIcon />
          {t('Add Dataflow')}
        </MenuItem>
      );
    }
    if (addFolderAllowed.includes(item.functionId)) {
      menuItems.push(
        <MenuItem key="addFolder" value={item.key} onClick={this.onAddFolderClick}>
          <FileAddIcon />
          {t('Add Folder')}
        </MenuItem>
      );
    }
    menuItems.push(
      <MenuItem key="search">
        <SearchIcon />
        {t('Search')}
      </MenuItem>
    );

    return menuItems;
  };

  onDragStart = (e: DragState) => {
    let {item} = this.props;
    let {desc} = this.state;
    let data: any = {path: item.key, functionId: item.functionId};
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

  disabledListener = new LazyUpdateSubscriber(this);
  hasChangeListener = new LazyUpdateSubscriber(this);
  nameListener = new LazyUpdateSubscriber(this);
  styleListener = new LazyUpdateSubscriber(this);

  constructor(props: Props) {
    super(props);
    let {item} = props;
    this.subscriptionListener.subscribe(item.connection, `${item.key}.#is`, true);
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
        let {item} = this.props;
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
    let {item, style, selected} = this.props;
    let {desc, error} = this.state;
    let dynamicStyle = this.styleListener.value;
    let displayName = this.nameListener.value;
    let marginLeft = item.level * 20;
    let contentClassName = 'ticl-tree-node-content';
    if (selected) {
      contentClassName += ' ticl-tree-node-selected';
    }
    let icon: React.ReactElement;

    let [colorClass, iconName] = getFuncStyleFromDesc(desc, item.getConn(), 'ticl-bg--');

    if (dynamicStyle) {
      let [dynamicColor, dynamicIcon] = getFuncStyleFromDesc(dynamicStyle, null, 'ticl-bg--');
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
          icon = <FileExclamationIcon />;
        } else {
          icon = <FileIcon />;
        }
      } else if (item.functionId === 'flow:const' || item.functionId === 'flow:global') {
        icon = <GlobalIcon />;
      } else if (item.functionId === 'flow:folder') {
        icon = <FolderIcon />;
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
    let onDoubleClick = this.context?.editFlow && quickOpenAllowed.has(item.functionId) ? this.onOpenBlock : null;

    let disabled = this.disabledListener.value;
    if (disabled == null && saveAllowed.has(item.functionId)) {
      // Force the DropDown to show the disable menu by not giving it null value
      disabled = false;
    }
    return (
      <div style={{...style, marginLeft}} className="ticl-tree-node">
        <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
        <BlockDropdown
          conn={item.getConn()}
          path={item.key}
          displayName={displayName}
          functionId={item.functionId}
          canApply={item.canApply}
          getMenu={this.getMenu}
          disabled={disabled}
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
    let {item} = this.props;
    this.subscriptionListener.unsubscribe();
    this.nameListener.unsubscribe();
    this.hasChangeListener.unsubscribe();
    item.connection.unwatchDesc(this.descCallback);
    super.componentWillUnmount();
  }
}
