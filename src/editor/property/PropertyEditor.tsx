import React from 'react';
import {Button, Tooltip, Dropdown, Input, Checkbox} from 'antd';
import DeleteIcon from '@ant-design/icons/DeleteOutlined';
import EditIcon from '@ant-design/icons/EditOutlined';
import LockIcon from '@ant-design/icons/LockOutlined';
import LockFilledIcon from '@ant-design/icons/LockFilled';
import {
  ClientConn,
  getOutputDesc,
  ValueState,
  ValueUpdate,
  blankPropDesc,
  FunctionDesc,
  getDefaultFuncData,
  PropDesc,
  PropGroupDesc,
  arrayEqual,
  deepEqual,
  stopPropagation,
  getTailingNumber,
  Logger,
  ValueSubscriber,
  DataMap,
  isBindable,
  getSubBlockFuncData,
  blankFuncDesc,
} from '../../../src/core/editor';
import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent';
import {StringEditor} from './value/StringEditor';
import {SelectEditor, MultiSelectEditor} from './value/SelectEditor';
import {RadioButtonEditor} from './value/RadioButtonEditor';
import {DragDropDiv, DragState} from 'rc-dock';
import {PasswordEditor} from './value/PasswordEditor';
import {ExpandIcon} from '../component/Tree';
import {PropertyList} from './PropertyList';
import {FunctionEditor} from './value/FunctionEditor';
import {FunctionSelect} from '../function-selector/FunctionSelector';
import {CheckboxChangeEvent} from 'antd/lib/checkbox';
import {AddCustomPropertyMenu} from './AddCustomProperty';
import {Popup, Menu, SubMenuItem} from '../component/ClickPopup';
import {ServiceEditor} from './value/ServiceEditor';
import {WorkerEditor} from './value/WorkerEditor';
import {DynamicEditor, dynamicEditorMap} from './value/DynamicEditor';
import {ReadonlyEditor} from './value/ReadonlyEditor';
import {ComboEditor} from './value/ComboEditor';
import {LocalizedPropertyName, t} from '../component/LocalizedLabel';
import {PropertyDropdown} from '../popup/PropertyDropdown';

const typeEditorMap: {[key: string]: any} = {
  ...dynamicEditorMap,
  'select': SelectEditor,
  'multi-select': MultiSelectEditor,
  'combo-box': ComboEditor,
  'password': PasswordEditor,
  'radio-button': RadioButtonEditor,
  'type': FunctionEditor,
  'worker': WorkerEditor,
  'none': ReadonlyEditor,
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
    this.valueListener.subscribe(this.conn, `${this.path}.${this.name}`);
    this.displayListener.subscribe(this.conn, `${this.path}.@b-p`);
  }

  cache: ValueState;
  subBlock = false;
  valueListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let changed = this.cache == null;
      this.cache = response.cache;
      if (response.change.hasOwnProperty('value') || response.change.hasOwnProperty('bindingPath')) {
        this.subBlock = response.cache.bindingPath === `~${this.name}.#output`;
        changed = true;
      }
      if (changed) {
        this.parent.forceUpdate();
      }
    },
  });
  displayListener = new ValueSubscriber({
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
    },
  });

  destroy() {
    this.valueListener.unsubscribe();
    this.displayListener.unsubscribe();
  }
}

export interface PropertyReorder {
  getDragData(props: PropertyEditorProps): DataMap;
  onDragOver(props: PropertyEditorProps, e: DragState): string;
  onDragDrop(props: PropertyEditorProps, e: DragState): void;
}

export interface PropertyEditorProps {
  conn: ClientConn;
  paths: string[];
  name: string; // name is usually same as propDesc.name, but when it's in group, it will have a number after
  funcDesc: FunctionDesc;
  propDesc: PropDesc;
  isCustom?: boolean;
  group?: string;
  baseName?: string; // the name used in propDesc.name
  reorder?: PropertyReorder;
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

export class PropertyEditor extends MultiSelectComponent<PropertyEditorProps, State, PropertyLoader> {
  constructor(props: Readonly<PropertyEditorProps>) {
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

  buildSubBlockPaths(props: PropertyEditorProps) {
    let {name, paths} = props;
    this.subBlockPaths = paths.map((s: string) => `${s}.~${name}`);
  }

  UNSAFE_componentWillReceiveProps(nextProps: PropertyEditorProps) {
    if (this.subBlockPaths && !arrayEqual(nextProps.paths, this.props.paths)) {
      this.buildSubBlockPaths(nextProps);
    }
  }

  unlock = (e: any) => {
    this.safeSetState({unlocked: !this.state.unlocked});
  };
  expandSubBlock = (e: any) => {
    this.safeSetState({showSubBlock: !this.state.showSubBlock});
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
    let {conn, paths, name, reorder} = this.props;

    if (e.dragType === 'right') {
      let data = reorder?.getDragData(this.props);
      if (data) {
        e.setData(data, conn.getBaseConn());
        e.startDrag();
      } else {
        return;
      }
    } else {
      let fields = paths.map((s) => `${s}.${name}`);
      e.setData({fields}, conn.getBaseConn());
      e.startDrag();
    }
  };
  onDragOver = (e: DragState) => {
    let {conn, paths, name, propDesc, reorder} = this.props;
    if (e.dragType === 'right') {
      // check reorder drag with right click
      let accepted = reorder?.onDragOver(this.props, e);
      if (accepted) {
        e.accept(accepted);
        return;
      }
    } else {
      // check drag from property
      let dragFields: string[] = DragState.getData('fields', conn.getBaseConn());
      if (Array.isArray(dragFields)) {
        if (!propDesc.readonly && (dragFields.length === 1 || dragFields.length === paths.length)) {
          if (dragFields.length === paths.length) {
            let bindable = false;
            for (let i = 0; i < paths.length; ++i) {
              if (isBindable(`${paths[i]}.${name}`, dragFields[i])) {
                bindable = true;
                break;
              }
            }
            if (!bindable) {
              e.reject();
              return;
            }
          }
          e.accept('tico-fas-link');
          return;
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
    let {conn, paths, name, reorder} = this.props;
    if (e.dragType === 'right') {
      reorder?.onDragDrop(this.props, e);
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
        PropertyDropdown.addSubBlock(this.props, blockData['#is'], null, getSubBlockFuncData(blockData));
        this.onAddSubBlock();
        return;
      }
    }
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

  onBindChange = (str: string) => {
    let {conn, paths, name} = this.props;
    if (str === '') {
      str = undefined;
    }
    for (let key of paths) {
      conn.setBinding(`${key}.${name}`, str);
    }
  };

  onAddSubBlock = () => {
    this.safeSetState({showSubBlock: true});
  };

  renderImpl() {
    let {conn, paths, funcDesc, propDesc, name, reorder, group, isCustom, baseName} = this.props;
    let {unlocked, showSubBlock, showMenu} = this.state;

    let onChange = propDesc.readonly ? null : this.onChange;

    let isIndexed = group != null && !name.endsWith('[]');

    let {count, value, valueSame, bindingPath, bindingSame, subBlock, display} = this.mergePropertyState();
    if (count === 0) {
      // not ready yet
      return (
        <div className="ticl-property">
          <div className="ticl-property-name">
            <LocalizedPropertyName desc={funcDesc} name={name} />
          </div>
          <div className="ticl-property-value">
            <div className="ticl-property-loader" />
          </div>
        </div>
      );
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
    let locktooltip: React.ReactNode;
    let lockIcon: React.ReactNode;
    if (renderLockIcon) {
      if (unlocked) {
        locktooltip = t('Unlocked for editing\nDouble click to lock');
        lockIcon = <EditIcon />;
      } else if (bindingPath) {
        locktooltip = t('Editing blocked by binding\nDouble click to edit');
        lockIcon = <LockFilledIcon />;
      } else if (!valueSame) {
        locktooltip = t('Inconsistent values\nDouble click to edit');
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
          locktooltip = t('Unlocked for editing\nDouble click to lock');
        } else if (!bindingSame) {
          locktooltip = t('Inconsistent values\nDouble click to edit');
        }
      }
      editor = (
        <ServiceEditor
          conn={conn}
          keys={paths}
          value={value}
          funcDesc={funcDesc}
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
            funcDesc={funcDesc}
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
        <PropertyDropdown
          funcDesc={funcDesc}
          propDesc={propDesc}
          bindingPath={bindingPath}
          conn={conn}
          group={group}
          value={value}
          isCustom={isCustom}
          display={display}
          paths={paths}
          name={name}
          baseName={baseName}
          onAddSubBlock={this.onAddSubBlock}
        >
          <DragDropDiv
            className={nameClass}
            onDragStartT={this.onDragStart}
            useRightButtonDragT={reorder != null}
            onDragOverT={this.onDragOver}
            onDropT={this.onDrop}
          >
            <LocalizedPropertyName desc={funcDesc} name={name} />
          </DragDropDiv>
        </PropertyDropdown>
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
