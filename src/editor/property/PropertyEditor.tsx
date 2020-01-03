import React from 'react';
import {Button, Tooltip, Dropdown, Input, Checkbox} from 'antd';
import DeleteIcon from '@ant-design/icons/DeleteOutlined';
import EditIcon from '@ant-design/icons/EditOutlined';
import LockIcon from '@ant-design/icons/LockOutlined';
import LockFilledIcon from '@ant-design/icons/LockFilled';
import {ClientConn, getOutputDesc, ValueState, ValueUpdate} from '../../core/client';
import {blankPropDesc, FunctionDesc, getDefaultFuncData, PropDesc, PropGroupDesc} from '../../core/block/Descriptor';
import {translateProperty} from '../../core/util/i18n';
import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent';
import {StringEditor} from './value/StringEditor';
import {SelectEditor, MultiSelectEditor} from './value/SelectEditor';
import {RadioButtonEditor} from './value/RadioButtonEditor';
import {DragDropDiv, DragState} from 'rc-dock';
import {PasswordEditor} from './value/PasswordEditor';
import {ExpandIcon} from '../../ui/component/Tree';
import {PropertyList} from './PropertyList';
import {arrayEqual, deepEqual} from '../../core/util/Compare';
import {stopPropagation} from '../../core/util/Functions';
import {TypeEditor} from './value/TypeEditor';
import {TypeSelect} from '../type-selector/TypeSelector';
import {CheckboxChangeEvent} from 'antd/lib/checkbox';
import {AddMorePropertyMenu} from './AddMoreProperty';
import {Popup, Menu, SubMenuItem} from '../component/ClickPopup';
import {ServiceEditor} from './value/ServiceEditor';
import {WorkerEditor} from './value/WorkerEditor';
import {getTailingNumber} from '../../core/util/String';
import {DynamicEditor, dynamicEditorMap} from './value/DynamicEditor';
import {ReadonlyEditor} from './value/ReadonlyEditor';
import {ComboEditor} from './value/ComboEditor';
import {Logger} from '../../core/util/Logger';

const typeEditorMap: {[key: string]: any} = {
  ...dynamicEditorMap,
  'select': SelectEditor,
  'multi-select': MultiSelectEditor,
  'combo-box': ComboEditor,
  'password': PasswordEditor,
  'radio-button': RadioButtonEditor,
  'type': TypeEditor,
  'worker': WorkerEditor,
  'none': ReadonlyEditor,
  'any': DynamicEditor
};

class PropertyLoader extends MultiSelectLoader<PropertyEditor> {
  name: string;
  bProperties: string[] = [];

  constructor(key: string, parent: PropertyEditor) {
    super(key, parent);
    this.name = parent.props.name;
  }

  init() {
    this.conn.subscribe(`${this.path}.${this.name}`, this.valueListener);
    this.conn.subscribe(`${this.path}.@b-p`, this.displayListener);
  }

  cache: ValueState;
  subBlock = false;
  valueListener = {
    onUpdate: (response: ValueUpdate) => {
      let changed = this.cache == null;
      this.cache = response.cache;
      if (response.change.hasOwnProperty('value') || response.change.hasOwnProperty('bindingPath')) {
        this.subBlock = response.cache.bindingPath === `~${this.name}.output`;
        changed = true;
      }
      if (changed) {
        this.parent.forceUpdate();
      }
    }
  };
  displayListener = {
    onUpdate: (response: ValueUpdate) => {
      let value = response.cache.value;
      if (!Array.isArray(value)) {
        value = [];
      }
      if (!deepEqual(value, this.bProperties)) {
        this.bProperties = value;
        if (this.cache) {
          // update only when cache is ready
          // this avoid an unnecessary render that cause all editor to blink
          this.parent.forceUpdate();
        }
      }
    }
  };

  destroy() {
    this.conn.unsubscribe(`${this.path}.${this.name}`, this.valueListener);
  }
}

interface Props {
  conn: ClientConn;
  paths: string[];
  name: string; // name is usually same as propDesc.name, but when it's in group, it will have a number after
  funcDesc: FunctionDesc;
  propDesc: PropDesc;
  isMore?: boolean;
  group?: string;
  baseName?: string; // the name used in propDesc.name
}

interface State {
  unlocked: boolean;
  showSubBlock: boolean;
  showMenu: boolean;
}

interface PropertyState {
  count: number;
  value?: any;
  valueSame: boolean;
  bindingPath?: string;
  bindingSame: boolean;
  subBlock: boolean;
  display: boolean;
  displaySame: boolean;
}

const notReadyState = {
  count: 0,
  valueSame: false,
  bindingSame: false,
  subBlock: false,
  display: false,
  displaySame: false
};

export class PropertyEditor extends MultiSelectComponent<Props, State, PropertyLoader> {
  constructor(props: Readonly<Props>) {
    super(props);
    this.state = {unlocked: false, showSubBlock: false, showMenu: false};
    this.updateLoaders(props.paths);
  }

  createLoader(path: string) {
    return new PropertyLoader(path, this);
  }

  // map parent paths to subblock paths
  // this needs to be cached to optimize children rendering
  subBlockPaths: string[];

  buildSubBlockPaths(props: Props) {
    let {name, paths} = props;
    this.subBlockPaths = paths.map((s: string) => `${s}.~${name}`);
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (this.subBlockPaths && !arrayEqual(nextProps.paths, this.props.paths)) {
      this.buildSubBlockPaths(nextProps);
    }
  }

  unlock = (e: any) => {
    this.setState({unlocked: !this.state.unlocked});
  };
  expandSubBlock = (e: any) => {
    this.setState({showSubBlock: !this.state.showSubBlock});
  };

  onChange = (value: any) => {
    let {conn, paths, name, propDesc} = this.props;
    if (value === propDesc.default) {
      switch (typeof value) {
        case 'number':
          // number value should only convert default 0 to undefined, to prevent confusing binding result
          if (value === 0) {
            value = undefined;
          }
          break;
        case 'boolean':
          // boolean value should only convert default false to undefined, to prevent confusing binding result
          if (value === false) {
            value = undefined;
          }
          break;
        default:
          value = undefined;
      }
    }
    for (let path of paths) {
      conn.setValue(`${path}.${name}`, value);
    }
  };

  onDragStart = (e: DragState) => {
    let {conn, paths, name, group, baseName, isMore} = this.props;

    if (e.dragType === 'right') {
      let data: any = {paths, fromGroup: group};
      let isLen = group != null && name.endsWith('#len');
      if (isMore) {
        // move more property
        let moveMoreField = baseName != null ? baseName : name;
        if (isLen) {
          moveMoreField = group;
          data.fromGroup = null;
        }
        data.moveMoreField = moveMoreField;
      }
      if (group != null && !isLen) {
        // move group index
        data.moveGroupIndex = getTailingNumber(name);
      }

      e.setData(data, conn.getBaseConn());
    } else {
      let fields = paths.map((s) => `${s}.${name}`);
      e.setData({fields}, conn.getBaseConn());
    }

    e.startDrag();
  };
  onDragOver = (e: DragState) => {
    let {conn, paths, name, propDesc, isMore, group, baseName} = this.props;
    if (e.dragType === 'right') {
      // check reorder drag with right click
      let moveFromKeys: string[] = DragState.getData('paths', conn.getBaseConn());
      if (deepEqual(moveFromKeys, paths)) {
        let isLen = group != null && name.endsWith('#len');
        let fromGroup = DragState.getData('fromGroup', conn.getBaseConn());
        if (isMore) {
          // move more property
          let moveFromKeys: string[] = DragState.getData('paths', conn.getBaseConn());
          let moveMoreField: string = DragState.getData('moveMoreField', conn.getBaseConn());

          if (moveMoreField != null) {
            let moveToField = baseName != null ? baseName : name;
            if (isLen) {
              moveToField = group;
              group = null;
            }

            // tslint:disable-next-line:triple-equals
            if (deepEqual(moveFromKeys, paths) && moveToField !== moveMoreField && group == fromGroup) {
              e.accept('tico-fas-exchange-alt');
              return;
            }
          }
        }
        if (group != null && !isLen && group === fromGroup) {
          // move group index
          let moveGroupIndex = DragState.getData('moveGroupIndex', conn.getBaseConn());
          let currentGroupIndex = getTailingNumber(name);
          if (moveGroupIndex !== currentGroupIndex) {
            e.accept('tico-fas-random');
            return;
          }
        }
      }
    } else {
      // check drag from property
      let dragFields: string[] = DragState.getData('fields', conn.getBaseConn());
      if (Array.isArray(dragFields)) {
        if (!propDesc.readonly && (dragFields.length === 1 || dragFields.length === paths.length)) {
          let fields = paths.map((s) => `${s}.${name}`);
          if (!deepEqual(fields, dragFields)) {
            e.accept('tico-fas-link');
            return;
          }
        }
      }
      // check drag from type
      let blockData = DragState.getData('blockData', conn.getBaseConn());
      if (blockData && blockData['#is']) {
        let desc = conn.watchDesc(blockData['#is']);
        let outProp = getOutputDesc(desc);
        if (outProp) {
          e.accept('tico-fas-plus-square');
          return;
        }
      }
    }
    e.reject();
  };
  onDrop = (e: DragState) => {
    let {conn, paths, name, isMore, group, baseName} = this.props;
    if (e.dragType === 'right') {
      // check reorder drag with right click
      let isLen = group != null && name.endsWith('#len');
      let fromGroup = DragState.getData('fromGroup', conn.getBaseConn());
      let moveFromKeys: string[] = DragState.getData('paths', conn.getBaseConn());
      if (deepEqual(moveFromKeys, paths)) {
        if (isMore) {
          // move more property
          let moveMoreField: string = DragState.getData('moveMoreField', conn.getBaseConn());

          let moveToField = baseName != null ? baseName : name;
          if (isLen) {
            moveToField = group;
            group = null;
          }

          // tslint:disable-next-line:triple-equals
          if (moveToField !== moveMoreField && group == fromGroup) {
            for (let key of paths) {
              conn.moveMoreProp(key, moveMoreField, moveToField, fromGroup);
            }
            return;
          }
        }
        if (group != null && !isLen && group === fromGroup) {
          // move group index
          let moveGroupIndex = DragState.getData('moveGroupIndex', conn.getBaseConn());
          let currentGroupIndex = getTailingNumber(name);
          for (let key of paths) {
            conn.moveGroupProp(key, fromGroup, moveGroupIndex, currentGroupIndex);
          }
        }
      }
    } else {
      // check drag from property
      let dragFields: string[] = DragState.getData('fields', conn.getBaseConn());
      if (Array.isArray(dragFields)) {
        let fields = paths.map((s) => `${s}.${name}`);
        if (dragFields.length === 1) {
          for (let field of fields) {
            if (dragFields[0] !== field) {
              conn.setBinding(field, dragFields[0], true);
            }
          }
        } else if (dragFields.length === fields.length) {
          for (let i = 0; i < fields.length; ++i) {
            if (dragFields[i] !== fields[i]) {
              conn.setBinding(fields[i], dragFields[i], true);
            }
          }
        }
        return;
      }
      // check drag from type
      let blockData = DragState.getData('blockData', conn.getBaseConn());
      if (blockData && blockData['#is']) {
        this.onAddSubBlock(blockData['#is'], null, blockData);
        return;
      }
    }
  };

  onAddMoreGroupChild = (desc: PropDesc | PropGroupDesc) => {
    let {conn, group} = this.props;
    for (let [key, subscriber] of this.loaders) {
      conn.addMoreProp(key, desc, group);
    }
    this.closeMenu();
  };

  mergePropertyState(): PropertyState {
    let it = this.loaders[Symbol.iterator]();
    let [firstKey, firstLoader] = it.next().value;
    let firstCache = firstLoader.cache;
    if (!firstCache) {
      return notReadyState;
    }

    let {name} = this.props;

    let count = this.loaders.size;
    let value = firstCache.value;
    let valueSame = true;
    let bindingPath = firstCache.bindingPath;
    let bindingSame = true;
    let subBlock = firstLoader.subBlock;
    let display = firstLoader.bProperties.includes(name);
    let displaySame = true;

    for (let [key, loader] of it) {
      let cache = loader.cache;
      if (!cache) {
        return notReadyState;
      }
      if (!Object.is(value, cache.value)) {
        valueSame = false;
      }
      if (bindingPath !== cache.bindingPath) {
        bindingSame = false;
        if (!bindingPath && cache.bindingPath) {
          bindingPath = cache.bindingPath;
        }
      }

      if (!loader.subBlock) {
        subBlock = false;
      }
      let thisDisplay = loader.bProperties.includes(name) !== display;
      if (thisDisplay !== display) {
        displaySame = false;
        if (thisDisplay) {
          display = true;
        }
      }
    }
    return {count, value, valueSame, bindingPath, bindingSame, subBlock, display, displaySame};
  }

  getMenu = () => {
    let {conn, isMore, name, group, propDesc} = this.props;
    let {count, value, valueSame, bindingPath, bindingSame, subBlock, display} = this.mergePropertyState();

    if (this.state.showMenu) {
      let menuItems: React.ReactElement[] = [];
      if (!propDesc.readonly) {
        if (!bindingPath) {
          menuItems.push(
            <SubMenuItem
              key="addSubBlock"
              popup={
                // <Menu.Item className='ticl-type-submenu'>
                <TypeSelect onClick={stopPropagation} conn={conn} showPreset={true} onTypeClick={this.onAddSubBlock} />
                // </Menu.Item>
              }
            >
              Add Sub Block
            </SubMenuItem>
          );
        }
        menuItems.push(
          <div key="deleteBinding" className="ticl-hbox">
            <span style={{flex: '0 1 100%'}}>Binding:</span>
            {bindingPath ? (
              <Button
                className="ticl-icon-btn"
                shape="circle"
                size="small"
                icon={<DeleteIcon />}
                onClick={this.onUnbindClick}
              />
            ) : null}
          </div>
        );
        menuItems.push(
          <div key="bindingInput" className="ticl-hbox">
            <StringEditor value={bindingPath} desc={blankPropDesc} onChange={this.onBindChange} />
          </div>
        );

        if (value !== undefined || bindingPath) {
          menuItems.push(
            <Button key="clear" shape="round" onClick={this.onClear}>
              Clear
            </Button>
          );
        }
      }
      if (group != null) {
        let groupIndex = getTailingNumber(name);
        if (groupIndex > -1) {
          menuItems.push(
            <Button key="insertIndex" shape="round" onClick={this.onInsertIndex}>
              Insert at {groupIndex}
            </Button>
          );
          menuItems.push(
            <Button key="deleteIndex" shape="round" onClick={this.onDeleteIndex}>
              Delete at {groupIndex}
            </Button>
          );
        }
      }

      menuItems.push(
        <Checkbox key="showHide" onChange={this.onShowHide} checked={display}>
          Show
        </Checkbox>
      );
      if (isMore) {
        menuItems.push(
          <Button key="removeFromMore" shape="round" onClick={this.onRemoveMore}>
            Remove Property
          </Button>
        );
        if (group != null) {
          menuItems.push(
            <SubMenuItem
              key="addMoreProp"
              popup={<AddMorePropertyMenu onAddProperty={this.onAddMoreGroupChild} group={group} />}
            >
              Add Child Property
            </SubMenuItem>
          );
        }
      }
      return <Menu>{menuItems}</Menu>;
    } else {
      // need this to hide all the submebu
      return <Menu />;
    }
  };

  closeMenu() {
    this.setState({showMenu: false});
  }

  onMenuVisibleChange = (flag: boolean) => {
    this.setState({showMenu: flag});
  };
  onBindChange = (str: string) => {
    let {conn, paths, name} = this.props;
    if (str === '') {
      str = undefined;
    }
    for (let key of paths) {
      conn.setBinding(`${key}.${name}`, str);
    }
  };
  onUnbindClick = (e: any) => {
    let {conn, paths, name} = this.props;
    for (let key of paths) {
      conn.setBinding(`${key}.${name}`, null, true);
    }
  };
  onAddSubBlock = (id: string, desc?: FunctionDesc, data?: any) => {
    let {conn, paths, name} = this.props;
    if (!desc) {
      desc = conn.watchDesc(id);
    }
    if (!data) {
      if (!desc) {
        Logger.error('unable to add sub block, missing id or desc or data', this);
        return;
      }
      data = getDefaultFuncData(desc, true);
    }

    for (let path of paths) {
      conn.createBlock(`${path}.~${name}`, data);
    }
    this.setState({showMenu: false, showSubBlock: true});
  };
  onShowHide = (e: CheckboxChangeEvent) => {
    let {conn, paths, name} = this.props;
    for (let path of paths) {
      if (e.target.checked) {
        conn.showProps(path, [name]);
      } else {
        conn.hideProps(path, [name]);
      }
    }
  };
  onClear = () => {
    let {conn, paths, name} = this.props;
    for (let path of paths) {
      conn.setValue(`${path}.${name}`, undefined);
    }
    this.closeMenu();
  };

  onInsertIndex = () => {
    let {conn, paths, name, group} = this.props;
    let index = getTailingNumber(name);
    for (let path of paths) {
      conn.insertGroupProp(path, group, index);
    }
    this.closeMenu();
  };
  onDeleteIndex = () => {
    let {conn, paths, name, group} = this.props;
    let index = getTailingNumber(name);
    for (let path of paths) {
      conn.removeGroupProp(path, group, index);
    }
    this.closeMenu();
  };

  onRemoveMore = () => {
    let {conn, paths, name, baseName, group} = this.props;
    let removeField = baseName != null ? baseName : name;
    if (group != null && name === `${group}#len`) {
      name = null;
    }
    for (let path of paths) {
      conn.removeMoreProp(path, removeField, group);
    }
    this.closeMenu();
  };

  renderImpl() {
    let {conn, paths, funcDesc, propDesc, name, isMore, group} = this.props;
    let {unlocked, showSubBlock, showMenu} = this.state;

    let onChange = propDesc.readonly ? null : this.onChange;

    let isIndexed = group != null && !name.endsWith('#len');

    let {count, value, valueSame, bindingPath, bindingSame, subBlock, display} = this.mergePropertyState();
    if (count === 0) {
      // not ready yet
      return <div className="ticl-property" />;
    }
    let inBoundClass;
    if (subBlock) {
      // inBoundClass = 'ticl-prop-inbound';
    } else if (bindingPath) {
      inBoundClass = 'ticl-property-inbound';
      if (!bindingSame) {
        bindingPath = '???';
      }
    } else if (!propDesc.readonly) {
      inBoundClass = 'ticl-property-input';
    }

    // lock icon
    let locked = bindingPath || !valueSame;
    let renderLockIcon = locked && !propDesc.readonly;
    let locktooltip: string;
    let lockIcon: React.ReactNode;
    if (renderLockIcon) {
      if (unlocked) {
        locktooltip = 'Unlocked for editing\nDouble click to lock';
        lockIcon = <EditIcon />;
      } else if (bindingPath) {
        locktooltip = 'Editing blocked by binding\nDouble click to edit';
        lockIcon = <LockFilledIcon />;
      } else if (!valueSame) {
        locktooltip = 'Inconsistent values\nDouble click to edit';
        lockIcon = <LockIcon />;
      }
    }

    // expand icon
    let renderSubBlock = subBlock && showSubBlock;
    if (renderSubBlock && !this.subBlockPaths) {
      this.buildSubBlockPaths(this.props);
    }

    let editor: React.ReactNode;
    if (propDesc.type === 'service') {
      locked = bindingPath && !bindingSame;
      renderLockIcon = locked && !propDesc.readonly;
      if (renderLockIcon) {
        if (unlocked) {
          locktooltip = 'Unlocked for editing\nDouble click to lock';
        } else if (!bindingSame) {
          locktooltip = 'Inconsistent values\nDouble click to edit';
        }
      }
      editor = (
        <ServiceEditor
          conn={conn}
          keys={paths}
          value={value}
          desc={propDesc}
          bindingPath={bindingPath}
          locked={locked && !unlocked}
          onPathChange={this.onBindChange}
        />
      );
    } else {
      let EditorClass = typeEditorMap[propDesc.type];
      if (!EditorClass) {
        EditorClass = ReadonlyEditor;
      }
      if (EditorClass) {
        let editorValue = value;
        if (value === undefined && propDesc.default != null) {
          editorValue = propDesc.default;
        }
        editor = (
          <EditorClass
            conn={conn}
            keys={paths}
            value={editorValue}
            desc={propDesc}
            name={name}
            locked={locked && !unlocked}
            onChange={onChange}
            addSubBlock={this.onAddSubBlock}
          />
        );
      }
    }

    let nameClass = `ticl-property-name${propDesc.readonly ? ' ticl-property-readonly' : ''}${
      display ? ' ticl-property-display' : ''
    }`;
    return (
      <div className="ticl-property">
        {inBoundClass ? <div className={inBoundClass} title={bindingPath} /> : null}
        <Popup
          popup={this.getMenu}
          trigger={['contextMenu']}
          popupVisible={showMenu}
          onPopupVisibleChange={this.onMenuVisibleChange}
        >
          <DragDropDiv
            className={nameClass}
            onDragStartT={this.onDragStart}
            useRightButtonDragT={isMore || isIndexed}
            onDragOverT={this.onDragOver}
            onDropT={this.onDrop}
          >
            {translateProperty(funcDesc.name, name, funcDesc.ns)}
          </DragDropDiv>
        </Popup>
        {renderLockIcon ? (
          <Tooltip title={locktooltip} overlayClassName="ticl-tooltip">
            <Button
              className="ticl-icon-btn"
              shape="circle"
              tabIndex={-1}
              icon={lockIcon}
              onDoubleClick={this.unlock}
            />
          </Tooltip>
        ) : null}
        {subBlock ? <ExpandIcon opened={showSubBlock ? 'opened' : 'closed'} onClick={this.expandSubBlock} /> : null}
        <div className="ticl-property-value">{editor}</div>
        {renderSubBlock ? <PropertyList conn={conn} paths={this.subBlockPaths} mode="subBlock" /> : null}
      </div>
    );
  }
}
