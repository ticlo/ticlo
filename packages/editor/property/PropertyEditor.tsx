import React from 'react';
import {Button, Tooltip, Dropdown, Input, Checkbox} from 'antd';
import {DeleteOutlined, EditOutlined, LockFilled, LockOutlined} from '@ant-design/icons';

import {
  ClientConn,
  getOutputDesc,
  ValueState,
  ValueUpdate,
  FunctionDesc,
  PropDesc,
  arrayEqual,
  deepEqual,
  ValueSubscriber,
  DataMap,
  isBindable,
  getSubBlockFuncData,
} from '@ticlo/core/editor.js';
import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent.js';
import {DragDrop, DragState} from 'rc-dock';
import {ExpandIcon} from '../component/Tree.js';
import {PropertyList} from './PropertyList.js';
import {ServiceEditor} from './value/ServiceEditor.js';
import {ReadonlyEditor} from './value/ReadonlyEditor.js';
import {LocalizedPropertyName, t} from '../component/LocalizedLabel.js';
import {PropertyDropdown} from '../popup/PropertyDropdown.js';
import {typeEditorMap} from './value/index.js';
import {propAcceptsBlock} from '@ticlo/core';

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
      if (Object.hasOwn(response.change, 'value') || Object.hasOwn(response.change, 'bindingPath')) {
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
  isTemp?: boolean;
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
  isTemp: boolean;
  bindingPath?: string;
  bindingSame: boolean;
  subBlock: boolean;
  display: boolean;
  displaySame: boolean;
}

const notReadyState = {
  count: 0,
  valueSame: false,
  isTemp: false,
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
    const {name, paths} = props;
    this.subBlockPaths = paths.map((s: string) => `${s}.~${name}`);
  }

  unlock = (e: any) => {
    this.safeSetState({unlocked: !this.state.unlocked});
  };
  expandSubBlock = (e: any) => {
    this.safeSetState({showSubBlock: !this.state.showSubBlock});
  };

  onChange = (value: any) => {
    const {conn, paths, name, propDesc} = this.props;
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
    for (const path of paths) {
      conn.setValue(`${path}.${name}`, value);
    }
  };

  onDragStart = (e: DragState) => {
    const {conn, paths, name, reorder} = this.props;

    if (e.dragType === 'right') {
      const data = reorder?.getDragData(this.props);
      if (data) {
        e.setData(data, conn.getBaseConn());
        e.startDrag();
      } else {
        return;
      }
    } else {
      const fields = paths.map((s) => `${s}.${name}`);
      e.setData({fields}, conn.getBaseConn());
      e.startDrag();
    }
  };
  onDragOver = (e: DragState) => {
    const {conn, paths, name, propDesc, reorder} = this.props;
    if (e.dragType === 'right') {
      // check reorder drag with right click
      const accepted = reorder?.onDragOver(this.props, e);
      if (accepted) {
        e.accept(accepted);
        return;
      }
    } else {
      // check drag from property
      const dragFields: string[] = DragState.getData('fields', conn.getBaseConn());
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
      if (propAcceptsBlock(propDesc)) {
        // bind from a block
        const moveBlock = DragState.getData('moveBlock', conn.getBaseConn());
        if (moveBlock) {
          e.accept('tico-fas-link');
          return;
        }
      }
      // check drag from type
      const blockData = DragState.getData('blockData', conn.getBaseConn());
      if (blockData && blockData['#is']) {
        const desc = conn.watchDesc(blockData['#is']);
        const outProp = getOutputDesc(desc);
        if (outProp) {
          e.accept('tico-fas-plus-square');
          return;
        }
      }
    }
    e.reject();
  };
  onDrop = (e: DragState) => {
    const {conn, propDesc, paths, name, reorder} = this.props;
    if (e.dragType === 'right') {
      reorder?.onDragDrop(this.props, e);
    } else {
      // check drag from property
      const dragFields: string[] = DragState.getData('fields', conn.getBaseConn());
      if (Array.isArray(dragFields)) {
        if (dragFields.length === 1) {
          for (const path of paths) {
            const field = `${path}.${name}`;
            if (dragFields[0] !== field) {
              conn.setBinding(field, dragFields[0], true);
            }
          }
        } else if (dragFields.length === paths.length) {
          for (let i = 0; i < paths.length; ++i) {
            const field = `${paths[i]}.${name}`;
            if (dragFields[i] !== field) {
              conn.setBinding(field, dragFields[i], true);
            }
          }
        }
        return;
      }
      if (propAcceptsBlock(propDesc)) {
        // bind from a block
        const moveBlock = DragState.getData('moveBlock', conn.getBaseConn());
        if (moveBlock) {
          for (const path of paths) {
            conn.setBinding(`${path}.${name}`, moveBlock, true);
          }
          // return 'field' to indicate the value is dropped on a property, this reset the moving block to original position
          return 'field';
        }
      }
      // check drag from type
      const blockData = DragState.getData('blockData', conn.getBaseConn());
      if (blockData && blockData['#is']) {
        this.onAddSubBlock(blockData['#is'], null, getSubBlockFuncData(blockData));
        return;
      }
    }
  };

  mergePropertyState(): PropertyState {
    const it = this.loaders[Symbol.iterator]();
    const [firstKey, firstLoader] = it.next().value;
    const firstCache = firstLoader.cache;
    if (!firstCache) {
      return notReadyState;
    }

    const {name} = this.props;

    const count = this.loaders.size;
    const value = firstCache.value;
    let valueSame = true;
    let isTemp = firstCache.temp;
    let bindingPath = firstCache.bindingPath;
    let bindingSame = true;
    let subBlock = firstLoader.subBlock;
    let display = firstLoader.bProperties.includes(name);
    let displaySame = true;

    for (const [key, loader] of it) {
      const cache = loader.cache;
      if (!cache) {
        return notReadyState;
      }
      if (!Object.is(value, cache.value)) {
        valueSame = false;
      }
      if (cache.temp) {
        isTemp = true;
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
      const thisDisplay = loader.bProperties.includes(name) !== display;
      if (thisDisplay !== display) {
        displaySame = false;
        if (thisDisplay) {
          display = true;
        }
      }
    }
    return {count, value, valueSame, isTemp, bindingPath, bindingSame, subBlock, display, displaySame};
  }

  onBindChange = (str: string) => {
    const {conn, paths, name} = this.props;
    if (str === '') {
      str = undefined;
    }
    for (const key of paths) {
      conn.setBinding(`${key}.${name}`, str);
    }
  };

  onAddSubBlock = (id: string, desc?: FunctionDesc, data?: any) => {
    PropertyDropdown.addSubBlock(this.props, id, desc, data);
    this.safeSetState({showSubBlock: true});
  };

  cachedPaths: string[] = [];
  renderImpl() {
    const {conn, paths, funcDesc, propDesc, name, reorder, group, isCustom, baseName} = this.props;
    const {unlocked, showSubBlock, showMenu} = this.state;

    if (this.subBlockPaths && !arrayEqual(this.cachedPaths, paths)) {
      this.cachedPaths = paths;
      this.buildSubBlockPaths(this.props);
    }

    const propertyName = isCustom ? <span>{name}</span> : <LocalizedPropertyName desc={funcDesc} name={name} />;

    const onChange = propDesc.readonly ? null : this.onChange;

    const isIndexed = group != null && !name.endsWith('[]');

    const propertyState = this.mergePropertyState();
    const {count, value, valueSame, isTemp, bindingSame, subBlock, display} = propertyState;
    let {bindingPath} = propertyState;
    if (count === 0) {
      // not ready yet
      return (
        <div className="ticl-property">
          <div className="ticl-property-name">{propertyName}</div>
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
        lockIcon = <EditOutlined />;
      } else if (bindingPath) {
        locktooltip = t('Editing blocked by binding\nDouble click to edit');
        lockIcon = <LockFilled />;
      } else if (!valueSame) {
        locktooltip = t('Inconsistent values\nDouble click to edit');
        lockIcon = <LockOutlined />;
      }
    }

    // expand icon
    const renderSubBlock = subBlock && showSubBlock;
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

    const nameClass = `ticl-property-name${propDesc.readonly ? ' ticl-property-readonly' : ''}${
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
          valueDefined={value !== undefined}
          isCustom={isCustom}
          isTemp={isTemp}
          display={display}
          paths={paths}
          name={name}
          baseName={baseName}
          onAddSubBlock={this.onAddSubBlock}
        >
          <DragDrop
            className={nameClass}
            onDragStartT={this.onDragStart}
            useRightButtonDragT={reorder != null}
            onDragOverT={this.onDragOver}
            onDropT={this.onDrop}
          >
            {propertyName}
          </DragDrop>
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
