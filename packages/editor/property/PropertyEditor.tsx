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
} from '@ticlo/core/editor.ts';
import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent.tsx';
import {DragDrop, DragState} from 'rc-dock';
import {ExpandIcon} from '../component/Tree.tsx';
import {PropertyList} from './PropertyList.tsx';
import {ServiceEditor} from './value/ServiceEditor.tsx';
import {ReadonlyEditor} from './value/ReadonlyEditor.tsx';
import {LocalizedPropertyName, t} from '../component/LocalizedLabel.tsx';
import {PropertyDropdown} from '../popup/PropertyDropdown.tsx';
import {typeEditorMap} from './value/index.ts';
import {propAcceptsBlock} from '@ticlo/core';
import {getDescLib} from '../util/FunctionLib.ts';
import {EditPolicyContext} from '../component/EditPolicyContext.tsx';
import {getObjectHelperData} from './ObjectHelper.ts';
import {requestCallbacks} from '../util/RequestCallbacks.ts';
import {isBaseObject} from '@ticlo/core/util/DataTypes.ts';

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
    const {propDesc, funcLib} = this.parent.props;
    if (propDesc.type === 'object' && propDesc.create) {
      this.conn.watchDesc(propDesc.create, getDescLib(propDesc.create, funcLib), this.onCreateDesc);
    }
  }

  cache: ValueState;
  subBlock = false;
  helperFuncId: string;
  createDesc: FunctionDesc;
  onCreateDesc = (desc: FunctionDesc) => {
    this.createDesc = desc;
    this.parent.forceUpdate();
  };
  helperListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      this.helperFuncId = response.cache.value;
      this.parent.forceUpdate();
    },
  });
  valueListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let changed = this.cache == null;
      this.cache = response.cache;
      if (Object.hasOwn(response.change, 'hasListener')) changed = true;
      if (Object.hasOwn(response.change, 'value') || Object.hasOwn(response.change, 'bindingPath')) {
        this.subBlock = response.cache.bindingPath === `~${this.name}.#output`;
        if (this.parent.props.propDesc.type === 'object' && this.parent.props.propDesc.create && this.subBlock) {
          this.helperListener.subscribe(this.conn, `${this.path}.~${this.name}.#is`);
        } else {
          this.helperListener.unsubscribe();
          this.helperFuncId = undefined;
        }
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
    this.helperListener.unsubscribe();
    this.conn.unwatchDesc(this.onCreateDesc);
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
  funcLib?: string;
}

interface State {
  unlocked: boolean;
  showSubBlock: boolean;
  showMenu: boolean;
  converting?: boolean;
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
  static contextType = EditPolicyContext;
  declare context: React.ContextType<typeof EditPolicyContext>;

  canWrite(value?: any, hasValue = false) {
    const {paths, name, propDesc} = this.props;
    return (
      !propDesc.readonly &&
      paths.every((path) =>
        this.context.can(
          name.endsWith('[]')
            ? {cmd: 'setLen', path, group: name.slice(0, -2), length: value}
            : {cmd: 'set', path: `${path}.${name}`, ...(hasValue ? {value} : {})}
        )
      )
    );
  }

  canBind() {
    return (
      !this.props.propDesc.readonly &&
      this.props.paths.every((path) => this.context.canBindField(`${path}.${this.props.name}`))
    );
  }

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
    if (!this.canWrite(value, true)) return;
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
        e.startDrag(undefined, undefined, {opacity: 0.9});
      } else {
        return;
      }
    } else {
      const fields = paths.map((s) => `${s}.${name}`);
      e.setData({fields}, conn.getBaseConn());
      e.startDrag(undefined, undefined, {opacity: 0.9});
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
        if (!this.canBind()) return e.reject();
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
          e.accept('tico-svg-link');
          return;
        }
      }
      if (propAcceptsBlock(propDesc)) {
        // bind from a block
        const moveBlock = DragState.getData('moveBlock', conn.getBaseConn());
        if (moveBlock && this.canBind()) {
          e.accept('tico-svg-link');
          return;
        }
      }
      // check drag from type
      const blockData = DragState.getData('blockData', conn.getBaseConn());
      if (blockData && blockData['#is']) {
        if (!paths.every((path) => this.context.canCreateBlock(`${path}.~${name}`, blockData['#is'])))
          return e.reject();
        const desc = conn.watchDesc(blockData['#is'], getDescLib(blockData['#is'], this.props.funcLib));
        const outProp = getOutputDesc(desc);
        if (outProp) {
          e.accept('tico-svg-square-plus');
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
    if (!this.canBind()) return;
    const {conn, paths, name} = this.props;
    if (str === '') {
      str = undefined;
    }
    for (const key of paths) {
      conn.setBinding(`${key}.${name}`, str);
    }
  };

  onAddSubBlock = (id: string, desc?: FunctionDesc, data?: any) => {
    if (!this.props.paths.every((path) => this.context.canCreateBlock(`${path}.~${this.props.name}`, id))) return;
    PropertyDropdown.addSubBlock(this.props, id, desc, data);
    this.safeSetState({showSubBlock: true});
  };

  canConvertObject(loader: PropertyLoader, toHelper: boolean) {
    const {name, propDesc} = this.props;
    if (propDesc.type !== 'object' || !propDesc.create || propDesc.readonly || !loader.cache) return false;
    const {value, bindingPath} = loader.cache;
    if (!value || typeof value !== 'object' || !isBaseObject(value)) return false;
    if (!this.context.can({cmd: 'get', path: `${loader.path}.${name}`})) return false;
    if (toHelper) {
      return (
        !bindingPath &&
        loader.createDesc != null &&
        this.context.canCreateBlock(`${loader.path}.~${name}`, propDesc.create)
      );
    }
    return (
      loader.subBlock &&
      loader.helperFuncId === propDesc.create &&
      this.context.can({cmd: 'set', path: `${loader.path}.${name}`}) &&
      this.context.canDeleteBlock(`${loader.path}.~${name}`)
    );
  }

  convertObject = async (toHelper: boolean) => {
    if (this.state.converting || ![...this.loaders.values()].every((loader) => this.canConvertObject(loader, toHelper)))
      return;
    const {conn, paths, name, propDesc, funcLib} = this.props;
    this.safeSetState({converting: true, showSubBlock: false});
    try {
      for (const path of paths) {
        const {value} = await conn.getValue(`${path}.${name}`);
        if (
          !this._mounted ||
          this.props.conn !== conn ||
          this.props.name !== name ||
          this.props.propDesc !== propDesc ||
          !arrayEqual(this.props.paths, paths) ||
          !this.canConvertObject(this.loaders.get(path), toHelper)
        )
          return;
        if (!value || typeof value !== 'object' || !isBaseObject(value)) throw new Error('Expected an object value');
        if (toHelper) {
          const desc = this.loaders.get(path).createDesc;
          const data = getObjectHelperData(desc, value, conn.getOptionalProps(desc, funcLib) || {});
          if (!this.context.can({cmd: 'addBlock', path: `${path}.~${name}`, data})) return;
          await conn.addBlock(`${path}.~${name}`, data);
        } else {
          if (!this.context.can({cmd: 'set', path: `${path}.${name}`, value})) return;
          await conn.setValue(`${path}.${name}`, value, true);
        }
      }
      if (toHelper) this.safeSetState({showSubBlock: true});
    } catch (error) {
      requestCallbacks.onError(String(error));
    } finally {
      this.safeSetState({converting: false});
    }
  };

  onConvertToHelper = () => this.convertObject(true);
  onConvertToObject = () => this.convertObject(false);

  cachedPaths: string[] = [];
  renderImpl() {
    const {conn, paths, funcDesc, name, reorder, group, isCustom, baseName, funcLib} = this.props;
    const {propDesc} = this.props;
    const readonly = !this.canWrite();
    const {unlocked, showSubBlock, showMenu} = this.state;

    if (this.subBlockPaths && !arrayEqual(this.cachedPaths, paths)) {
      this.cachedPaths = paths;
      this.buildSubBlockPaths(this.props);
    }

    const propertyName = isCustom ? <span>{name}</span> : <LocalizedPropertyName desc={funcDesc} name={name} />;

    const onChange = readonly ? null : this.onChange;

    const isIndexed = group != null && !name.endsWith('[]');

    const propertyState = this.mergePropertyState();
    const {count, value, valueSame, isTemp, bindingSame, subBlock, display} = propertyState;
    let {bindingPath} = propertyState;
    if (count === 0) {
      // not ready yet
      return (
        <div className="ticl-e-property">
          <div className="ticl-e-property-name">{propertyName}</div>
          <div className="ticl-e-property-value">
            <div className="ticl-e-property-loader" />
          </div>
        </div>
      );
    }
    let inBoundClass;
    if (subBlock) {
      // inBoundClass = 'ticl-e-prop-inbound';
    } else if (bindingPath) {
      inBoundClass = 'ticl-e-property-inbound';
      if (!bindingSame) {
        bindingPath = '???';
      }
    } else if (!readonly) {
      inBoundClass = 'ticl-e-property-input';
    }

    // lock icon
    let locked = bindingPath || !valueSame;
    let renderLockIcon = locked && !readonly;
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
      renderLockIcon = locked && !readonly;
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
          onPathChange={this.canBind() ? this.onBindChange : null}
          funcLib={funcLib}
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
          onConvertToHelper={
            !this.state.converting && [...this.loaders.values()].every((loader) => this.canConvertObject(loader, true))
              ? this.onConvertToHelper
              : undefined
          }
          onConvertToObject={
            !this.state.converting && [...this.loaders.values()].every((loader) => this.canConvertObject(loader, false))
              ? this.onConvertToObject
              : undefined
          }
          funcLib={funcLib}
        />
      );
    }

    const nameClass = `ticl-e-property-name${readonly ? ' ticl-e-property-readonly' : ''}${
      display ? ' ticl-e-property-display' : ''
    }`;
    return (
      <div className="ticl-e-property">
        {inBoundClass ? <div className={inBoundClass} title={bindingPath} /> : null}
        <PropertyDropdown
          funcDesc={funcDesc}
          propDesc={this.props.propDesc}
          bindingPath={bindingPath}
          hasListener={paths.length === 1 && this.loaders.get(paths[0])?.cache?.hasListener}
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
          funcLib={funcLib}
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
          <Tooltip title={locktooltip} overlayClassName="ticl-e-tooltip">
            <Button
              className="ticl-e-icon-btn"
              shape="circle"
              tabIndex={-1}
              icon={lockIcon}
              onDoubleClick={this.unlock}
            />
          </Tooltip>
        ) : null}
        {subBlock ? <ExpandIcon opened={showSubBlock ? 'opened' : 'closed'} onClick={this.expandSubBlock} /> : null}
        <div className="ticl-e-property-value">{editor}</div>
        {renderSubBlock ? (
          <PropertyList conn={conn} paths={this.subBlockPaths} mode="subBlock" funcLib={funcLib} />
        ) : null}
      </div>
    );
  }
}
