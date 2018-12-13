import React from "react";
import {WireItem} from "./Wire";
import {DataRendererItem, PureDataRenderer} from "../../ui/component/DataRenderer";
import {DataMap} from "../../common/util/Types";
import {relative, resolve} from "../../common/util/Path";
import equal from "fast-deep-equal";
import {translateProperty} from "../../common/util/i18n";
import {displayValue, shallowEqual} from "../../ui/util/Types";
import {ClientConnection, ValueUpdate} from "../../common/connect/ClientConnection";
import {blankFuncDesc, FunctionDesc} from "../../common/block/Descriptor";
import {DragInitFunction} from "../../ui/util/DragHelper";
import {compareArray} from "../../common/util/Compare";
import {TIcon} from "../icon/Icon";

export interface Stage {
  linkField(sourceKey: string, targetField: FieldItem): void;

  unlinkField(sourceKey: string, targetField: FieldItem): void;

  registerField(key: string, item: FieldItem): void;

  unregisterField(key: string, item: FieldItem): void;

  forceUpdate(): void;

  selectBlock(key: string, ctrl?: boolean): void;

  dragStart(e: PointerEvent, initFunction: DragInitFunction): void;

  isDraggingBlock(): boolean;

  // get a reference elemtnt to measure the scale of the current stage
  getRefElement(): HTMLElement;
}

interface ValueRenderer {
  renderValue(value: any): void;
}

export class FieldItem extends DataRendererItem<ValueRenderer> {
  block: BaseBlockItem;
  name: string;
  key: string;

  indent = 0;
  subBlock?: SubBlockItem;

  x: number = 0;
  y: number = 0;
  w: number = 0;

  inWire?: WireItem;
  outWires: Set<WireItem> = new Set<WireItem>();

  _bindingPath?: string;

  setBindingPath(str: string) {
    if (str !== this._bindingPath) {
      if (this._bindingPath) {
        this.block.stage.unlinkField(resolve(this.block.key, this._bindingPath), this);
      }
      if (this.subBlock) {
        this.subBlock.destructor();
        this.subBlock = null;
        this.block.onFieldsChanged();
      }
      this._bindingPath = str;
      if (this._bindingPath) {
        if (this._bindingPath === `~${this.name}.output`) {
          this.subBlock = new SubBlockItem(this.block.conn, this.block.stage, `${this.block.key}.~${this.name}`, this);
        } else {
          this.block.stage.linkField(resolve(this.block.key, this._bindingPath), this);
        }
      }
      return true;
    }
    return false;
  }

  indents: number[] = [];

  // return y pos of next field
  updateFieldPos(x: number, y: number, w: number, dy: number, indents: number[] = []): number {
    if (x !== this.x || y !== this.y || w !== this.w) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.forceUpdateWires();
    }
    if (!shallowEqual(indents, this.indents)) {
      this.indents = indents.concat();
      this.forceUpdate();
    }
    y += dy;
    if (this.subBlock) {
      y = this.subBlock.updateFieldPos(x, y, w, dy, indents);
    }
    return y;
  }

  forceUpdateWires(recursiv = false) {
    if (this.inWire) {
      this.inWire.forceUpdate();
    }
    for (let outWire of this.outWires) {
      outWire.forceUpdate();
    }
    if (recursiv && this.subBlock) {
      for (let [name, child] of this.subBlock.fieldItems) {
        child.forceUpdateWires(true);
      }
    }
  }

  conn() {
    return this.block.conn;
  }

  cache: any = {};
  listener = {
    onUpdate: (response: ValueUpdate) => {
      let change = response.change;
      if (!equal(response.cache, this.cache)) {
        this.cache = response.cache;
        if (change.hasOwnProperty('value')) {
          for (let renderer of this._renderers) {
            renderer.renderValue(change.value);
          }
        }
        if (
          (
            change.hasOwnProperty('bindingPath')
            && this.setBindingPath(response.cache.bindingPath)
          )
          || change.hasOwnProperty('hasListener')
        ) {
          this.forceUpdate();
        }
      }
    }
  };

  constructor(block: BaseBlockItem, name: string) {
    super();
    this.name = name;
    this.block = block;
    this.key = `${block.key}.${name}`;
    this.block.conn.subscribe(this.key, this.listener);
    this.block.stage.registerField(this.key, this);
  }

  destructor() {
    this.block.conn.unsubscribe(this.key, this.listener);
    this.block.stage.unregisterField(this.key, this);
    if (this._bindingPath) {
      this.block.stage.unlinkField(resolve(this.key, this._bindingPath), this);
    }
    if (this.inWire) {
      this.inWire = null;
      this.block.stage.forceUpdate();
    }
    if (this.subBlock) {
      this.subBlock.destructor();
    }
  }

  render(): React.ReactNode {
    if (this.subBlock) {
      return (
        <div key={this.key} className='ticl-field-subblock'>
          <FieldView key={this.key} item={this}/>
          {this.subBlock.renderFields()}
        </div>
      );
    } else {
      return <FieldView key={this.key} item={this}/>;
    }

  }

  sourceChanged(source: FieldItem) {
    if (source) {
      if (this.inWire) {
        this.inWire.setSource(source);
      } else {
        this.inWire = new WireItem(source, this);
        this.block.stage.forceUpdate();
      }
    } else {
      if (this.inWire) {
        this.inWire = null;
        this.block.stage.forceUpdate();
      }
    }
  }
}


interface FieldViewProps {
  item: FieldItem;
}


export class FieldView extends PureDataRenderer<FieldViewProps, any> {

  private _valueNode!: HTMLElement;
  private getValueRef = (node: HTMLDivElement): void => {
    this._valueNode = node;
    let {item} = this.props;
    this.renderValue(item.cache.value);
  };

  onDragStart = (event: React.DragEvent) => {
    let e = event.nativeEvent;
    let {item} = this.props;
    let desc = item.block.desc;
    e.dataTransfer.setData('ticl-field', item.key);
  };
  onDragOver = (event: React.DragEvent) => {
    let e = event.nativeEvent;
    if (e.dataTransfer.types.includes('ticl-field')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'link';
    }
  };
  onDrop = (event: React.DragEvent) => {
    let e = event.nativeEvent;
    let {item} = this.props;
    let desc = item.block.desc;
    let dropField = e.dataTransfer.getData('ticl-field');
    if (dropField !== item.key) {
      let bindingPath = relative(item.block.key, dropField);
      item.conn().setBinding(item.key, bindingPath);
    }
  };

  onSubIconClick = (event: React.MouseEvent) => {
    let {item} = this.props;
    if (item.subBlock) {
      item.conn().setValue(`${item.subBlock.key}.@b-hide`, item.subBlock.hidden ? undefined : true);
    }
  };

  renderValue(value: any) {
    if (this._valueNode) {
      let {item} = this.props;
      displayValue(item.cache.value, this._valueNode);
    }
  }

  render(): React.ReactNode {
    let {item} = this.props;
    let desc = item.block.desc;

    let inBoundClass = 'ticl-slot';
    let inBoundText: string;
    if (item.cache.bindingPath) {
      inBoundClass += ' ticl-inbound';
      if (!item.inWire) {
        inBoundClass += ' ticl-inbound-path';
        inBoundText = item.cache.bindingPath;
      }
    }
    let indentChildren = [];
    for (let i = 0; i < item.indents.length; ++i) {
      indentChildren.push(<div key={i} className={`ticl-field-indent${item.indents[i]}`}/>);
    }
    return (
      <div className='ticl-field' draggable={true} onDragStart={this.onDragStart} onDragOver={this.onDragOver}
           onDrop={this.onDrop}>
        {indentChildren}
        <div className='ticl-field-name'>{translateProperty(desc.name, item.name, desc.ns)}</div>
        <div className='ticl-field-value'><span ref={this.getValueRef}/></div>
        {(item.subBlock)
          ?
          <div
            className={`ticl-field-subicon ticl-block-prbg${item.subBlock.hidden ? ' ticl-field-subicon-close' : ''}`}
            style={{left: item.indents.length * 16}} onDoubleClick={this.onSubIconClick}>
            <TIcon icon={item.subBlock.desc.icon}/>
          </div>
          :
          <div className={inBoundClass}>{inBoundText}</div>
        }
        {(item.cache.hasListener) ? <div className='ticl-outbound'/> : null}
      </div>
    );
  }
}

export interface XYWRenderer {
  renderXYW(x: number, y: number, z: number): void;
}

export abstract class BaseBlockItem extends DataRendererItem<XYWRenderer> {
  conn: ClientConnection;
  stage: Stage;
  x: number = 0;
  y: number = 0;
  w: number = 0;
  key: string;
  name: string;
  desc: FunctionDesc = blankFuncDesc;
  fields: string[] = [];
  fieldItems: Map<string, FieldItem> = new Map<string, FieldItem>();

  abstract get selected(): boolean;

  constructor(connection: ClientConnection, stage: Stage, key: string) {
    super();
    this.conn = connection;
    this.stage = stage;
    this.key = key;
    this.name = key.substr(key.indexOf('.') + 1);
  }

  // renderer both the block and children fields
  abstract forceRendererChildren(): void ;

  abstract onFieldsChanged(): void;

  isListener = {
    onUpdate: (response: ValueUpdate) => {
      let {value} = response.cache;
      if (typeof value === 'string') {
        this.conn.watchDesc(value, this.descListener);
      } else {
        this.conn.unwatchDesc(this.descListener);
      }
    }
  };
  pListener = {
    onUpdate: (response: ValueUpdate) => {
      let {value} = response.cache;
      if (Array.isArray(value)) {
        this.setP(value);
      }
    }
  };

  descLoaded = false;
  descListener = (funcDesc: FunctionDesc) => {
    if (funcDesc) {
      this.setDesc(funcDesc);
    } else {
      this.setDesc(blankFuncDesc);
    }
    this.descLoaded = true;
  };

  startSubscribe() {
    this.conn.subscribe(`${this.key}.#is`, this.isListener);
    this.conn.subscribe(`${this.key}.@b-p`, this.pListener);
  }

  setDesc(desc: FunctionDesc) {
    if (desc !== this.desc) {
      this.desc = desc;
      this.forceUpdate();
      this.forceRendererChildren();
    }
  }

  createField(name: string): FieldItem {
    return new FieldItem(this, name);
  }

  setP(fields: string[]) {
    if (!compareArray(fields, this.fields)) {
      for (let f of this.fields) {
        if (!fields.includes(f)) {
          this.fieldItems.get(f).destructor();
          this.fieldItems.delete(f);
        }
      }
      this.fields = fields;
      for (let f of fields) {
        if (!this.fieldItems.has(f)) {
          this.fieldItems.set(f, this.createField(f));
        }
      }
      this.onFieldsChanged();
    }
  }

  forceUpdateFields() {
    for (let [key, item] of this.fieldItems) {
      item.forceUpdate();
    }
  }

  renderFields(): React.ReactNode[] {
    let result: React.ReactNode[] = [];
    for (let field of this.fields) {
      result.push(this.fieldItems.get(field).render());
    }
    return result;
  }

  destructor() {
    for (let [key, fieldItem] of this.fieldItems) {
      fieldItem.destructor();
    }
    this.conn.unsubscribe(`${this.key}.#is`, this.isListener);
    this.conn.unsubscribe(`${this.key}.@b-p`, this.pListener);
    this.conn.unwatchDesc(this.descListener);
  }
}


class SubBlockItem extends BaseBlockItem {

  parentField: FieldItem;

  constructor(connection: ClientConnection, stage: Stage, key: string, field: FieldItem) {
    super(connection, stage, key);
    this.parentField = field;
    this.startSubscribe();
  }

  createField(name: string): FieldItem {
    return new FieldItem(this, name);
  }

  hidden = true;
  hideListener = {
    onUpdate: (response: ValueUpdate) => {
      let hidden = Boolean(response.cache.value);
      if (hidden !== this.hidden) {
        this.hidden = hidden;
        if (hidden) {
          this.setP([]);
        } else if (this.realFields) {
          this.setP(this.realFields);
        }
        this.onFieldsChanged();
        this.forceRendererChildren();
      }
    }
  };

  // maintain the real fields list even when they are hidden
  realFields: string[];
  pListener = {
    onUpdate: (response: ValueUpdate) => {
      let {value} = response.cache;
      if (Array.isArray(value)) {
        this.realFields = value;
        if (!this.hidden) {
          this.setP(value);
        }
      }
    }
  };

  startSubscribe() {
    super.startSubscribe();
    this.conn.subscribe(`${this.key}.@b-hide`, this.hideListener);
  }

  get selected() {
    return this.parentField.block.selected;
  }

  // render the whole block
  forceUpdate() {
    this.parentField.block.forceUpdate();
  }

  forceRendererChildren() {
    // refresh parent field to update icon
    this.parentField.forceUpdate();
    this.forceUpdateFields();
  }

  onFieldsChanged(): void {
    this.parentField.block.onFieldsChanged();
  }

  updateFieldPos(x: number, y: number, w: number, dy: number, indents: number[]): number {
    let newIndents = indents.concat([3]);
    for (let j = 0; j < indents.length; ++j) {
      if (newIndents[j] > 1) {
        newIndents[j] -= 2;
      }
    }
    for (let i = 0; i < this.fields.length; ++i) {
      let field = this.fields[i];
      if (i === this.fields.length - 1) {
        newIndents[indents.length] = 2;
      }
      y = this.fieldItems.get(field).updateFieldPos(x, y, w, dy, newIndents);
    }
    return y;
  }

  destructor() {
    this.conn.unsubscribe(`${this.key}.@b-hide`, this.hideListener);
    super.destructor();
  }

}