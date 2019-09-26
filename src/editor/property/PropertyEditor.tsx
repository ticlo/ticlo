import React from "react";
import {Button, Tooltip, Dropdown, Input, Checkbox} from "antd";
import {ClientConn, ValueState, ValueUpdate} from "../../core/client";
import {blankPropDesc, FunctionDesc, getDefaultFuncData, PropDesc, PropGroupDesc} from "../../core/block/Descriptor";
import {translateProperty} from "../../core/util/i18n";
import {MultiSelectComponent, MultiSelectLoader} from "./MultiSelectComponent";
import {GroupEditor} from "./GroupEditor";
import {NumberEditor} from "./value/NumberEditor";
import {StringEditor} from "./value/StringEditor";
import {ToggleEditor} from "./value/ToggleEditor";
import {SelectEditor} from "./value/SelectEditor";
import {ColorEditor} from "./value/ColorEditor";
import {DateEditor} from "./value/DateEditor";
import {DateRangeEditor} from "./value/DateRangeEditor";
import {RadioButtonEditor} from "./value/RadioButtonEditor";
import {DragDropDiv, DragState} from "rc-dock";
import {PasswordEditor} from "./value/PasswordEditor";
import {ExpandIcon} from "../../ui/component/Tree";
import {PropertyList} from "./PropertyList";
import {arrayEqual, deepEqual} from "../../core/util/Compare";
import {ClickParam} from "antd/lib/menu";
import {stopPropagation} from "../../core/util/Functions";
import {TypeEditor} from "./value/TypeEditor";
import {TypeSelect} from "../type-selector/TypeSelector";
import {CheckboxChangeEvent} from "antd/lib/checkbox";
import {AddMorePropertyMenu} from "./AddMoreProperty";
import {Popup, Menu, SubMenuItem} from "../component/ClickPopup";
import {ServiceEditor} from "./value/ServiceEditor";
import {WorkerEditor} from "./value/WorkerEditor";
import {getTailingNumber} from "../../core/util/String";
import {DynamicEditor, dynamicEditorMap} from "./value/DynamicEditor";

const typeEditorMap: {[key: string]: any} = {
  ...dynamicEditorMap,
  'select': SelectEditor,
  'password': PasswordEditor,
  'radio-button': RadioButtonEditor,
  'type': TypeEditor,
  'worker': WorkerEditor,
  'any': DynamicEditor,
};

class PropertyLoader extends MultiSelectLoader<PropertyEditor> {
  name: string;
  bProperties: string[] = [];

  constructor(key: string, parent: PropertyEditor) {
    super(key, parent);
    this.name = parent.props.name;
  }

  init() {
    this.conn.subscribe(`${this.key}.${this.name}`, this.valueListener);
    this.conn.subscribe(`${this.key}.@b-p`, this.displayListener);
  }

  cache: ValueState;
  subBlock = false;
  valueListener = {
    onUpdate: (response: ValueUpdate) => {
      this.cache = response.cache;
      if (response.change.hasOwnProperty('value') || response.change.hasOwnProperty('bindingPath')) {
        this.subBlock = response.cache.bindingPath === `~${this.name}.output`;
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
    this.conn.unsubscribe(`${this.key}.${this.name}`, this.valueListener);
  }

}

interface Props {
  conn: ClientConn;
  keys: string[];
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
  displaySame: false,
};

export class PropertyEditor extends MultiSelectComponent<Props, State, PropertyLoader> {

  constructor(props: Readonly<Props>) {
    super(props);
    this.state = {unlocked: false, showSubBlock: false, showMenu: false};
    this.updateLoaders(props.keys);
  }

  createLoader(key: string) {
    return new PropertyLoader(key, this);
  }

  // map parent keys to subblock keys
  // this needs to be cached to optimize children rendering
  subBlockKeys: string[];

  buildSubBlockKeys(props: Props) {
    let {name, keys} = props;
    this.subBlockKeys = keys.map((s: string) => `${s}.~${name}`);
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (this.subBlockKeys && !arrayEqual(nextProps.keys, this.props.keys)) {
      this.buildSubBlockKeys(nextProps);
    }
  }

  unlock = (e: any) => {
    this.setState({unlocked: !this.state.unlocked});
  };
  expandSubBlock = (e: any) => {
    this.setState({showSubBlock: !this.state.showSubBlock});
  };

  onChange = (value: any) => {
    let {conn, keys, name, propDesc} = this.props;
    if (value === propDesc.default) {
      value = undefined;
    }
    for (let key of keys) {
      conn.setValue(`${key}.${name}`, value);
    }
  };


  onDragStart = (e: DragState) => {
    let {conn, keys, name, group, baseName, isMore} = this.props;

    if (e.dragType === 'right') {
      let data: any = {keys, fromGroup: group};
      let isLen = group != null && name.endsWith('#len');
      if (isMore) {
        // move more property
        let moveMoreField = (baseName != null) ? baseName : name;
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

      e.setData(data, conn);
    } else {
      let fields = keys.map((s) => `${s}.${name}`);
      e.setData({fields}, conn);
    }

    e.startDrag();
  };
  onDragOver = (e: DragState) => {
    let {conn, keys, name, propDesc, isMore, group, baseName} = this.props;
    if (e.dragType === 'right') {
      let moveFromKeys: string[] = DragState.getData('keys', conn);
      if (deepEqual(moveFromKeys, keys)) {
        let isLen = group != null && name.endsWith('#len');
        let fromGroup = DragState.getData('fromGroup', conn);
        if (isMore) {
          // move more property
          let moveFromKeys: string[] = DragState.getData('keys', conn);
          let moveMoreField: string = DragState.getData('moveMoreField', conn);

          if (moveMoreField != null) {
            let moveToField = (baseName != null) ? baseName : name;
            if (isLen) {
              moveToField = group;
              group = null;
            }

            // tslint:disable-next-line:triple-equals
            if (deepEqual(moveFromKeys, keys) && moveToField !== moveMoreField && group == fromGroup) {
              e.accept('tico-fas-exchange-alt');
              return;
            }
          }
        }
        if (group != null && !isLen && group === fromGroup) {
          // move group index
          let moveGroupIndex = DragState.getData('moveGroupIndex', conn);
          let currentGroupIndex = getTailingNumber(name);
          if (moveGroupIndex !== currentGroupIndex) {
            e.accept('tico-fas-random');
            return;
          }
        }
      }
    } else {
      let dragFields: string[] = DragState.getData('fields', conn);
      if (Array.isArray(dragFields)) {
        if (!propDesc.readonly && (dragFields.length === 1 || dragFields.length === keys.length)) {
          let fields = keys.map((s) => `${s}.${name}`);
          if (!deepEqual(fields, dragFields)) {
            e.accept('tico-fas-link');
            return;
          }
        }
      }
    }
    e.reject();
  };
  onDrop = (e: DragState) => {
    let {conn, keys, name, isMore, group, baseName} = this.props;
    if (e.dragType === 'right') {
      let isLen = group != null && name.endsWith('#len');
      let fromGroup = DragState.getData('fromGroup', conn);
      let moveFromKeys: string[] = DragState.getData('keys', conn);
      if (deepEqual(moveFromKeys, keys)) {
        if (isMore) {
          // move more property
          let moveMoreField: string = DragState.getData('moveMoreField', conn);

          let moveToField = (baseName != null) ? baseName : name;
          if (isLen) {
            moveToField = group;
            group = null;
          }

          // tslint:disable-next-line:triple-equals
          if (moveToField !== moveMoreField && group == fromGroup) {
            for (let key of keys) {
              conn.moveMoreProp(key, moveMoreField, moveToField, fromGroup);
            }
            return;
          }
        }
        if (group != null && !isLen && group === fromGroup) {
          // move group index
          let moveGroupIndex = DragState.getData('moveGroupIndex', conn);
          let currentGroupIndex = getTailingNumber(name);
          for (let key of keys) {
            conn.moveGroupProp(key, fromGroup, moveGroupIndex, currentGroupIndex);
          }
        }
      }
    } else {
      let dragFields: string[] = DragState.getData('fields', conn);
      if (Array.isArray(dragFields)) {
        let fields = keys.map((s) => `${s}.${name}`);
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
      }
    }
  };

  onAddMoreGroupChild = (desc: PropDesc | PropGroupDesc) => {
    let {conn, group} = this.props;
    for (let [key, subscriber] of this.loaders) {
      conn.addMoreProp(key, desc, group);
    }
    this.setState({showMenu: false});
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
            <SubMenuItem key='addSubBlkock' popup={(
              // <Menu.Item className='ticl-type-submenu'>
              <TypeSelect onClick={stopPropagation} conn={conn} showPreset={true} onTypeClick={this.onAddSubBlock}/>
              // </Menu.Item>
            )}>
              Add Sub Block
            </SubMenuItem>
          );
        }
        menuItems.push(
          <div key='deleteBinding' className='ticl-hbox'>
            <span style={{flex: '0 1 100%'}}>Binding:</span>
            {bindingPath ?
              <Button className='ticl-icon-btn' shape='circle' size='small' icon="delete"
                      onClick={this.onUnbindClick}/>
              : null}
          </div>
        );
        menuItems.push(
          <div key='bindingInput' className='ticl-hbox'>
            <StringEditor value={bindingPath} desc={blankPropDesc} onChange={this.onBindChange}/>
          </div>
        );

        if (value || bindingPath) {
          menuItems.push(
            <Button key='clear' shape='round' onClick={this.onClear}>Clear</Button>
          );
        }
      }
      if (group != null) {
        let groupIndex = getTailingNumber(name);
        if (groupIndex > -1) {
          menuItems.push(
            <Button key='insertIndex' shape='round' onClick={this.onInsertIndex}>Insert at {groupIndex}</Button>
          );
          menuItems.push(
            <Button key='deleteIndex' shape='round' onClick={this.onDeleteIndex}>Delete at {groupIndex}</Button>
          );
        }
      }

      menuItems.push(
        <Checkbox key='showHide' onChange={this.onShowHide} checked={display}>Show</Checkbox>
      );
      if (isMore) {
        menuItems.push(
          <Button key='removeFromMore' shape='round' onClick={this.onRemoveMore}>Remove Property</Button>
        );
        if (group != null) {
          menuItems.push(
            <SubMenuItem key='addMoreProp'
                         popup={
                           <AddMorePropertyMenu onAddProperty={this.onAddMoreGroupChild} group={group}/>
                         }>
              Add Child Property
            </SubMenuItem>
          );
        }
      }
      return (
        <Menu>
          {menuItems}
        </Menu>
      );
    } else {
      // need this to hide all the submebu
      return <Menu/>;
    }
  };

  closeMenu() {
    this.setState({showMenu: false});
  }

  onMenuVisibleChange = (flag: boolean) => {
    this.setState({showMenu: flag});
  };
  onBindChange = (str: string) => {
    let {conn, keys, name} = this.props;
    if (str === '') {
      str = undefined;
    }
    for (let key of keys) {
      conn.setBinding(`${key}.${name}`, str);
    }
  };
  onUnbindClick = (e: any) => {
    let {conn, keys, name} = this.props;
    for (let key of keys) {
      conn.setBinding(`${key}.${name}`, undefined);
    }
  };
  onAddSubBlock = (id: string, desc: FunctionDesc, data: any) => {
    if (!data) {
      data = getDefaultFuncData(desc, true);
    }
    let {conn, keys, name} = this.props;

    for (let key of keys) {
      conn.createBlock(`${key}.~${name}`, data);
    }
    this.closeMenu();
  };
  onShowHide = (e: CheckboxChangeEvent) => {
    let {conn, keys, name} = this.props;
    for (let key of keys) {
      if (e.target.checked) {
        conn.showProps(key, [name]);
      } else {
        conn.hideProps(key, [name]);
      }
    }
  };
  onClear = () => {
    let {conn, keys, name} = this.props;
    for (let key of keys) {
      conn.setValue(`${key}.${name}`, undefined);
    }
    this.closeMenu();
  };

  onInsertIndex = () => {
    let {conn, keys, name, group} = this.props;
    let index = getTailingNumber(name);
    for (let key of keys) {
      conn.insertGroupProp(key, group, index);
    }
    this.setState({showMenu: false});
  };
  onDeleteIndex = () => {
    let {conn, keys, name, group} = this.props;
    let index = getTailingNumber(name);
    for (let key of keys) {
      conn.removeGroupProp(key, group, index);
    }
    this.setState({showMenu: false});
  };

  onRemoveMore = () => {
    let {conn, keys, name, group} = this.props;
    if (group != null && name === `${group}#len`) {
      name = null;
    }
    for (let key of keys) {
      conn.removeMoreProp(key, name, group);
    }
  };

  renderImpl() {
    let {conn, keys, funcDesc, propDesc, name, isMore, group} = this.props;
    let {unlocked, showSubBlock, showMenu} = this.state;

    let onChange = propDesc.readonly ? null : this.onChange;

    let isIndexed = group != null && !name.endsWith('#len');

    let {count, value, valueSame, bindingPath, bindingSame, subBlock, display} = this.mergePropertyState();
    if (count === 0) {
      // not ready yet
      return <div className='ticl-property'/>;
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
    let locked = (bindingPath || !valueSame);
    let renderLockIcon = locked && !propDesc.readonly;
    let locktooltip: string;
    if (renderLockIcon) {
      if (unlocked) {
        locktooltip = 'Unlocked for editing\nDouble click to lock';
      } else if (bindingPath) {
        locktooltip = 'Editing blocked by binding\nDouble click to edit';
      } else if (!valueSame) {
        locktooltip = 'Inconsistent values\nDouble click to edit';
      }
    }

    // expand icon
    let renderSubBlock = subBlock && showSubBlock;
    if (renderSubBlock && !this.subBlockKeys) {
      this.buildSubBlockKeys(this.props);
    }

    let editor: React.ReactNode;
    let EditorClass = typeEditorMap[propDesc.type];
    if (EditorClass) {
      let editorValue = value;
      if (value === undefined && propDesc.default != null) {
        editorValue = propDesc.default;
      }
      editor = (
        <EditorClass conn={conn} keys={keys} value={editorValue} desc={propDesc} locked={locked && !unlocked}
                     onChange={onChange}/>
      );
    } else if (propDesc.type === 'service') {
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
        <ServiceEditor conn={conn} keys={keys} value={value} desc={propDesc} bindingPath={bindingPath}
                       locked={locked && !unlocked} onPathChange={this.onBindChange}/>
      );
    }

    let nameClass = `ticl-property-name${propDesc.readonly ? ' ticl-property-readonly' : ''}${display ? ' ticl-property-display' : ''}`;
    return (
      <div className='ticl-property'>
        {inBoundClass ? <div className={inBoundClass} title={bindingPath}/> : null}
        <Popup popup={this.getMenu} trigger={['contextMenu']} popupVisible={showMenu}
               onPopupVisibleChange={this.onMenuVisibleChange}>
          <DragDropDiv className={nameClass} onDragStartT={this.onDragStart}
                       useRightButtonDragT={isMore || isIndexed}
                       onDragOverT={this.onDragOver} onDropT={this.onDrop}>
            {translateProperty(funcDesc.name, name, funcDesc.ns)}
          </DragDropDiv>
        </Popup>
        {renderLockIcon ?
          <Tooltip title={locktooltip} overlayClassName='ticl-tooltip'>
            <Button className='ticl-icon-btn' shape='circle' tabIndex={-1} icon={unlocked ? 'edit' : 'lock'}
                    onDoubleClick={this.unlock}> </Button>
          </Tooltip>
          : null}
        {subBlock ?
          <ExpandIcon opened={showSubBlock ? 'opened' : 'closed'} onClick={this.expandSubBlock}/>
          : null
        }
        <div className='ticl-property-value'>
          {editor}
        </div>
        {
          renderSubBlock ?
            <PropertyList conn={conn} keys={this.subBlockKeys} mode='subBlock'/>
            : null
        }
      </div>
    );
  }
}
