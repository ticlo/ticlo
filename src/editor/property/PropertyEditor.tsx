import React from "react";
import {Button, Tooltip, Dropdown, Menu, Input} from "antd";
import {ClientConnection, ValueState, ValueUpdate} from "../../common/connect/ClientConnection";
import {blankPropDesc, FunctionDesc, PropDesc} from "../../common/block/Descriptor";
import {translateProperty} from "../../common/util/i18n";
import {MultiSelectComponent, MultiSelectLoader} from "./MultiSelectComponent";
import {GroupEditor} from "./GroupEditor";
import {NumberEditor} from "./value/NumberEditor";
import {StringEditor} from "./value/StringEditor";
import {ToggleEditor} from "./value/ToggleEditor";
import {SelectEditor} from "./value/SelectEditor";
import {DragStore} from "../../ui/util/DragStore";
import equal from "fast-deep-equal";
import {PasswordEditor} from "./value/PasswordEditor";
import {ExpandIcon} from "../../ui/component/Tree";
import {PropertyList} from "./PropertyList";
import {arrayEqual} from "../../common/util/Compare";
import {ClickParam} from "antd/lib/menu";
import {stopPropagation} from "../../common/util/Functions";

const {SubMenu} = Menu;

const typeEditorMap: {[key: string]: any} = {
  'number': NumberEditor,
  'string': StringEditor,
  'toggle': ToggleEditor,
  'select': SelectEditor,
  'password': PasswordEditor,
};

class PropertyLoader extends MultiSelectLoader<PropertyEditor> {
  name: string;
  bProperties: string[] = [];

  constructor(key: string, parent: PropertyEditor) {
    super(key, parent);
    this.name = parent.props.name;
    this.conn.subscribe(`${key}.${this.name}`, this.valueListener);
    this.conn.subscribe(`${key}.@b-p`, this.displayListener);

  }

  cache: ValueState;
  subBlock = false;
  valueListener = {
    onUpdate: (response: ValueUpdate) => {
      this.cache = response.cache;
      if (response.change.hasOwnProperty('value') || response.change.hasOwnProperty('bindingPath')) {
        this.subBlock = response.cache.bindingPath === `~${this.name}.output`;
        this.parent.safeForceUpdate();
      }
    }
  };
  displayListener = {
    onUpdate: (response: ValueUpdate) => {
      let value = response.cache.value;
      if (!Array.isArray(value)) {
        value = [];
      }
      if (!equal(value, this.bProperties)) {
        this.bProperties = value;
        this.parent.safeForceUpdate();
      }
    }
  };

  destroy() {
    this.conn.unsubscribe(`${this.key}.${this.name}`, this.valueListener);
  }

}

interface Props {
  conn: ClientConnection;
  keys: string[];
  name: string; // name is usually same as propDesc.name, but when it's in group, it will have a number after
  funcDesc: FunctionDesc;
  propDesc: PropDesc;
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
    this.updateLoaders(props.keys, PropertyLoader);
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
    let {conn, keys, name} = this.props;
    for (let key of keys) {
      conn.setValue(`${key}.${name}`, value);
    }
  };


  onDragStart = (event: React.DragEvent) => {
    let {conn, keys, name} = this.props;

    let fields = keys.map((s) => `${s}.${name}`);
    event.dataTransfer.setData('text/plain', fields.join(','));

    DragStore.dragStart(conn, {fields});
  };
  onDragOver = (event: React.DragEvent) => {
    let {conn, keys, name, propDesc} = this.props;

    if (propDesc.readonly) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }

    let dragFields: string[] = DragStore.getData(conn, 'fields');
    if (Array.isArray(dragFields) &&
      (dragFields.length === 1 || dragFields.length === keys.length)) {
      let fields = keys.map((s) => `${s}.${name}`);
      if (!equal(fields, dragFields)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'link';
        return;
      }
    }
    event.dataTransfer.dropEffect = 'none';
  };
  onDrop = (event: React.DragEvent) => {
    let {conn, keys, name} = this.props;

    let dragFields: string[] = DragStore.getData(conn, 'fields');
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
  };
  onDragEnd = (event: React.DragEvent) => {
    DragStore.dragEnd();
  };

  getPropertyState(): PropertyState {
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
    let {count, value, valueSame, bindingPath, bindingSame, subBlock, display} = this.getPropertyState();
    if (this.state.showMenu) {
      return (
        <Menu selectable={false} className='ticl-dropdown-menu' onClick={this.onMenuClick}>
          <SubMenu title="Add Sub Block">
            <Menu.Item>
              <Input onClick={stopPropagation} size='small' onPressEnter={this.onAddSubBlock}/>
            </Menu.Item>
          </SubMenu>
          <Menu.Item>
            <div className='ticl-hbox'>
              <span style={{flex: '0 1 100%'}}>Binding:</span>
              {bindingPath ?
                <Button className='ticl-icon-btn' shape='circle' size='small' icon="delete" tooltip='Unbind'
                onClick={this.onUnbindClick}/>
                : null}
            </div>
            <div className='ticl-hbox'>
              <StringEditor value={bindingPath} desc={blankPropDesc} onChange={this.onBindChange}/>
            </div>
          </Menu.Item>
        </Menu>
      );
    } else {
      // need this to hide all the submebu
      return <Menu selectable={false} className='ticl-dropdown-menu' onClick={this.onMenuClick}/>;
    }
  };

  closeMenu() {
    this.setState({showMenu: false});
  }

  onMenuClick = (param: ClickParam) => {
    //
  };

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
  onAddSubBlock = (e: React.KeyboardEvent) => {
    let str = (e.nativeEvent.target as HTMLInputElement).value;
    if (str) {
      this.closeMenu();
    }
  };

  renderImpl() {
    let {conn, keys, funcDesc, propDesc, name} = this.props;
    let {unlocked, showSubBlock, showMenu} = this.state;

    this.updateLoaders(keys, PropertyLoader);

    let onChange = propDesc.readonly ? null : this.onChange;

    let {count, value, valueSame, bindingPath, bindingSame, subBlock, display} = this.getPropertyState();
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
      editor =
        <EditorClass value={value} desc={propDesc} locked={locked && !unlocked} onChange={onChange}/>;
    }

    let nameClass = `ticl-property-name${propDesc.readonly ? ' ticl-property-readonly' : ''}${display ? ' ticl-property-display' : ''}`;
    return (
      <div className='ticl-property'>
        {inBoundClass ? <div className={inBoundClass} title={bindingPath}/> : null}
        <Dropdown overlay={this.getMenu} trigger={['contextMenu']} visible={showMenu}
                  onVisibleChange={this.onMenuVisibleChange}>
          <div className={nameClass} draggable={true} onDragStart={this.onDragStart}
               onDragOver={this.onDragOver} onDrop={this.onDrop} onDragEnd={this.onDragEnd}>
            {translateProperty(funcDesc.name, name, funcDesc.ns)}
          </div>
        </Dropdown>
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
            <PropertyList conn={conn} keys={this.subBlockKeys}/>
            : null
        }
      </div>
    );
  }
}
