import React, {MouseEventHandler} from "react";
import {WireItem} from "./Wire";
import {DataRendererItem, PureDataRenderer} from "../../ui/component/DataRenderer";
import {DataMap} from "../../core/util/Types";
import {relative, resolve} from "../../core/util/Path";
import {translateProperty} from "../../core/util/i18n";
import {displayValue} from "../../ui/util/Types";
import {ClientConnection, ValueUpdate} from "../../core/connect/ClientConnection";
import {
  blankFuncDesc,
  blankPropDesc, buildPropDescCache,
  findPropDesc,
  FunctionDesc,
  PropDesc,
  PropGroupDesc
} from "../../core/block/Descriptor";
import {arrayEqual, deepEqual} from "../../core/util/Compare";
import {TIcon} from "../icon/Icon";
import {DragDropDiv, DragState} from "rc-dock";
import * as DragManager from "rc-dock/src/dragdrop/DragManager";

export interface Stage {

  getBlock(key: string): BlockItem;

  getNextXYW(): [number, number, number];

  linkParentBlock(parentKey: string, targetBlock: BlockItem): void;

  unlinkParentBlock(parentKey: string, targetBlock: BlockItem): void;

  linkField(sourceKey: string, targetField: FieldItem): void;

  unlinkField(sourceKey: string, targetField: FieldItem): void;

  registerField(key: string, item: FieldItem): void;

  unregisterField(key: string, item: FieldItem): void;

  forceUpdate(): void;

  selectBlock(key: string, ctrl?: boolean): void;

  startDragBlock(e: DragState): [BlockItem, number, number, number][];

  onDragBlockMove(e: DragState): void;

  onDragBlockEnd(e: DragState): void;

  isDraggingBlock(): boolean;

  // get a reference element to measure the scale of the current stage
  getRefElement(): HTMLElement;

  onChildrenSizeChanged(): void;

  // since DragDropDiv prevent default focus, need to manually trigger it
  focus(): void;
}

interface ValueRenderer {
  renderValue(value: any): void;
}

export class FieldItem extends DataRendererItem<ValueRenderer> {
  block: BaseBlockItem;
  name: string;
  key: string;
  desc: PropDesc = blankPropDesc;

  indent = 0;
  subBlock?: SubBlockItem;

  x: number = 0;
  y: number = 0;
  w: number = 0;

  inWire?: WireItem;
  outWires: Set<WireItem> = new Set<WireItem>();

  _bindingPath?: string;
  _absBinding?: string;
  _bindingTargetKey?: string;

  setBindingPath(str: string) {
    if (str !== this._bindingPath) {
      if (this._bindingTargetKey) {
        this.block.stage.unlinkField(this._bindingTargetKey, this);
      }
      if (this.subBlock) {
        // subBlock can only exist on one binding path, it always disappears when binding path change
        this.subBlock.destroy();
        this.subBlock = null;
        this.block.onFieldsChanged();
      }
      this._bindingPath = str;
      this._bindingTargetKey = resolve(this.block.key, this._bindingPath);

      if (this._bindingTargetKey) {
        if (this._bindingPath === `~${this.name}.output`) {
          // binding block
          this.subBlock = new SubBlockItem(this.block.conn, this.block.stage, `${this.block.key}.~${this.name}`, this);
        } else {
          // binding wire
          this.block.stage.linkField(this._bindingTargetKey, this);
        }
      } else {
        this.removeInWire();
      }
      return true;
    }
    return false;
  }

  setDesc(desc: PropDesc) {
    if (desc !== this.desc) {
      this.desc = desc;
      this.forceUpdate();
    }
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
    if (!arrayEqual(indents, this.indents)) {
      this.indents = indents.concat();
      this.forceUpdate();
    }
    y += dy;
    if (this.subBlock) {
      if (this.subBlock.hidden) {
        // share the same row with hidden properties
        y = this.subBlock.updateFieldPos(x, y - dy, w, 0, indents) + dy;
      } else {
        y = this.subBlock.updateFieldPos(x, y, w, dy, indents);
      }
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

  getConn() {
    return this.block.conn;
  }

  cache: any = {};
  listener = {
    onUpdate: (response: ValueUpdate) => {
      let change = response.change;
      if (!deepEqual(response.cache, this.cache)) {
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

  destroy() {
    this.block.conn.unsubscribe(this.key, this.listener);
    this.block.stage.unregisterField(this.key, this);
    if (this._bindingTargetKey) {
      this.block.stage.unlinkField(this._bindingTargetKey, this);
    }
    this.removeInWire();
    if (this.subBlock) {
      this.subBlock.destroy();
    }
  }

  removeInWire() {
    if (this.inWire) {
      this.inWire.destroy();
      this.inWire = null;
      this.block.stage.forceUpdate();
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

  sourceChanged(source: FieldItem, partial = false) {
    if (source) {
      if (this.inWire) {
        if (partial && source.key.length < this.inWire.source.key.length) {
          // already has a better link
          return;
        }
        this.inWire.setSource(source);
      } else {
        this.inWire = new WireItem(source, this);
        this.block.stage.forceUpdate();
      }
    } else {
      this.removeInWire();
    }
  }
}


interface FieldViewProps {
  item: FieldItem;
}

interface BlockHeaderProps extends FieldViewProps {
  onDragStartT?: DragManager.DragHandler;
  onDragMoveT?: DragManager.DragHandler;
  onDragEndT?: DragManager.DragHandler;
  onDoubleClick?: MouseEventHandler;
}

export class BlockHeaderView extends PureDataRenderer<BlockHeaderProps, any> {

  onDragOver = (e: DragState) => {
    let {item} = this.props;
    if (e.dragType !== 'right') {
      let fields: string[] = DragState.getData('fields', item.getConn());
      if (Array.isArray(fields)) {
        if (!item.desc.readonly && fields.length === 1 && fields[0] !== item.key) {
          e.accept('tico-fas-play');
          return;
        }
      }
    }
  };
  onDrop = (event: DragState) => {
    let {item} = this.props;
    if (event.dragType !== 'right') {
      let fields: string[] = DragState.getData('fields', item.getConn());
      if (Array.isArray(fields) && fields.length === 1 && fields[0] !== item.key) {
        item.getConn().setBinding(item.key, fields[0], true);
      }
    }
  };

  renderValue(value: any) {
    // do nothing
  }

  renderImpl(): React.ReactNode {
    let {item, onDragStartT, onDragMoveT, onDragEndT, onDoubleClick, children} = this.props;
    let inBoundClass: string;
    let inBoundText: string;
    let inBoundTitle: string;
    let showOutBound = false;

    if (item) {
      if (item.cache.bindingPath) {
        inBoundClass = 'ticl-slot ticl-inbound';
        if (item.subBlock) {
          inBoundClass = null;
        } else if (item.inWire) {
          inBoundTitle = item.cache.bindingPath;
        } else {
          inBoundClass += ' ticl-inbound-path';
          inBoundText = item.cache.bindingPath;
        }
      }
      showOutBound = item.cache.hasListener || (item.subBlock && item.subBlock.hidden);
    }

    return (
      <DragDropDiv className='ticl-block-head ticl-block-prbg' directDragT={true} onDoubleClick={onDoubleClick}
                   onDragStartT={onDragStartT} onDragMoveT={onDragMoveT} onDragEndT={onDragEndT}
                   onDragOverT={item ? this.onDragOver : null} onDropT={item ? this.onDrop : null}>
        {inBoundClass ? <div className={inBoundClass} title={inBoundTitle}>{inBoundText}</div> : null}
        {showOutBound ? <div className='ticl-outbound'/> : null}
        {(item && item.subBlock) ?
          <div className='ticl-field-subicon ticl-block-prbg'>
            <TIcon icon={item.subBlock.desc.icon}/>
          </div>
          : null
        }
        {children}
      </DragDropDiv>
    );
  }
}

export class FieldView extends PureDataRenderer<FieldViewProps, any> {

  private _valueNode!: HTMLElement;
  private getValueRef = (node: HTMLDivElement): void => {
    if (this._valueNode !== node) {
      this._valueNode = node;
      let {item} = this.props;
      this.renderValue(item.cache.value);
    }
  };

  onDragStart = (e: DragState) => {
    let {item} = this.props;
    if (e.dragType === 'right') {
      e.setData({moveShownField: item.name, block: item.block}, item.getConn());
    } else {
      e.setData({fields: [item.key]}, item.getConn());
    }

    e.startDrag();
  };
  onDragOver = (e: DragState) => {
    let {item} = this.props;
    if (e.dragType === 'right') {
      let moveShownField = DragState.getData('moveShownField', item.getConn());
      let block = DragState.getData('block', item.getConn());
      if (block === item.block && moveShownField !== item.name) {
        e.accept('tico-fas-exchange-alt');
        return;
      }
    } else {
      let fields: string[] = DragState.getData('fields', item.getConn());
      if (Array.isArray(fields)) {
        if (!item.desc.readonly && fields.length === 1 && fields[0] !== item.key) {
          e.accept('tico-fas-link');
          return;
        }
      }
    }


    e.reject();
  };
  onDrop = (event: DragState) => {
    let {item} = this.props;
    if (event.dragType === 'right') {
      let moveShownField = DragState.getData('moveShownField', item.getConn());
      let block = DragState.getData('block', item.getConn());
      if (block === item.block) {
        item.getConn().moveShownProp(block.key, moveShownField, item.name);
      }
    } else {
      let fields: string[] = DragState.getData('fields', item.getConn());
      if (Array.isArray(fields) && fields.length === 1 && fields[0] !== item.key) {
        item.getConn().setBinding(item.key, fields[0], true);
      }
    }
  };

  onNameDoubleClick = (event: React.MouseEvent) => {
    let {item} = this.props;
    if (item.subBlock) {
      item.getConn().setValue(`${item.subBlock.key}.@b-hide`, item.subBlock.hidden ? undefined : true);
    }
  };

  renderValue(value: any) {
    if (this._valueNode) {
      let {item} = this.props;
      displayValue(item.cache.value, this._valueNode);
    }
  }

  renderImpl(): React.ReactNode {
    let {item} = this.props;
    let desc = item.block.desc;

    let fieldClass = 'ticl-field';
    let inBoundClass = 'ticl-slot';
    let inBoundText: string;
    let inBoundTitle: string;
    if (item.cache.bindingPath) {
      inBoundClass = 'ticl-slot ticl-inbound';
      if (item.subBlock) {
        if (item.subBlock.hidden) {
          fieldClass = 'ticl-field ticl-field-close';
        } else {
          inBoundClass = null;
        }
      } else if (item.inWire) {
        inBoundTitle = item.cache.bindingPath;
      } else {
        inBoundClass += ' ticl-inbound-path';
        inBoundText = item.cache.bindingPath;
      }
    } else if (item.desc.readonly) {
      inBoundClass = null;
    }
    let indentChildren = [];
    for (let i = 0; i < item.indents.length; ++i) {
      indentChildren.push(<div key={i} className={`ticl-field-indent${item.indents[i]}`}/>);
    }
    let showOutBound = item.cache.hasListener || (item.subBlock && item.subBlock.hidden);
    return (
      <DragDropDiv className={fieldClass} onDragStartT={this.onDragStart} useRightButtonDragT={true}
                   onDragOverT={this.onDragOver} onDropT={this.onDrop}>
        {inBoundClass ? <div className={inBoundClass} title={inBoundTitle}>{inBoundText}</div> : null}
        {showOutBound ? <div className='ticl-outbound'/> : null}
        {indentChildren}
        <div className='ticl-field-name' onDoubleClick={this.onNameDoubleClick}>
          {(item.subBlock) ?
            <div
              className='ticl-field-subicon ticl-block-prbg'
              style={{left: item.indents.length * 18}}>
              <TIcon icon={item.subBlock.desc.icon}/>
            </div>
            : null
          }
          {translateProperty(desc.name, item.name, desc.ns)}
        </div>
        <div className='ticl-field-value'><span ref={this.getValueRef}/></div>
      </DragDropDiv>
    );
  }
}

export interface XYWRenderer {
  renderXYW(x: number, y: number, z: number): void;

  renderH(h: number): void;
}

export abstract class BaseBlockItem extends DataRendererItem<XYWRenderer> {
  conn: ClientConnection;
  stage: Stage;
  x: number = 0;
  y: number = 0;
  w: number = 0;
  xyzInvalid = true;

  key: string;
  name: string;
  desc: FunctionDesc = blankFuncDesc;
  more: (PropDesc | PropGroupDesc)[];
  propDescCache: {[key: string]: PropDesc};
  fields: string[] = [];
  fieldItems: Map<string, FieldItem> = new Map<string, FieldItem>();

  getRenderFields() {
    return this.fields;
  }

  abstract get selected(): boolean;

  constructor(connection: ClientConnection, stage: Stage, key: string) {
    super();
    this.conn = connection;
    this.stage = stage;
    this.key = key;
    this.name = key.substr(key.lastIndexOf('.') + 1);
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
  moreListener = {
    onUpdate: (response: ValueUpdate) => {
      let value = response.cache.value;
      if (!Array.isArray(value)) {
        value = null;
      }
      if (!deepEqual(value, this.more)) {
        this.more = value;
        this.updatePropCache();
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
    this.setDesc(funcDesc || blankFuncDesc);
    this.descLoaded = true;
  };

  startSubscribe() {
    this.conn.subscribe(`${this.key}.#is`, this.isListener, true);
    this.conn.subscribe(`${this.key}.#more`, this.moreListener, true);
    this.conn.subscribe(`${this.key}.@b-p`, this.pListener, true);
  }

  setDesc(desc: FunctionDesc) {
    if (desc !== this.desc) {
      this.desc = desc;
      this.updatePropCache();
      this.forceUpdate();
      this.forceRendererChildren();
    }
  }

  createField(name: string): FieldItem {
    let item = new FieldItem(this, name);
    item.setDesc(findPropDesc(name, this.propDescCache));
    return item;
  }

  setP(fields: string[], forceRefresh = false) {
    if (!arrayEqual(fields, this.fields)) {
      for (let f of this.fields) {
        if (!fields.includes(f)) {
          this.fieldItems.get(f).destroy();
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
    } else if (forceRefresh) {
      this.fields = fields;
      this.onFieldsChanged();
    }
  }

  updatePropCache() {
    this.propDescCache = buildPropDescCache(this.desc, this.more);
    for (let [key, item] of this.fieldItems) {
      item.setDesc(findPropDesc(key, this.propDescCache));
    }
  }

  forceUpdateFields() {
    for (let [key, item] of this.fieldItems) {
      item.forceUpdate();
    }
  }

  renderFields(): React.ReactNode[] {
    let result: React.ReactNode[] = [];
    for (let field of this.getRenderFields()) {
      result.push(this.fieldItems.get(field).render());
    }
    return result;
  }

  destroy() {
    for (let [key, fieldItem] of this.fieldItems) {
      fieldItem.destroy();
    }
    this.conn.unsubscribe(`${this.key}.#is`, this.isListener);
    this.conn.unsubscribe(`${this.key}.#more`, this.moreListener);
    this.conn.unsubscribe(`${this.key}.@b-p`, this.pListener);
    this.conn.unwatchDesc(this.descListener);
  }

  getConn() {
    return this.conn;
  }
}


class SubBlockItem extends BaseBlockItem {

  parentField: FieldItem;

  constructor(connection: ClientConnection, stage: Stage, key: string, field: FieldItem) {
    super(connection, stage, key);
    this.parentField = field;
    this.startSubscribe();
  }

  hidden = true;
  hideListener = {
    onUpdate: (response: ValueUpdate) => {
      let hidden = Boolean(response.cache.value);
      if (hidden !== this.hidden) {
        this.hidden = hidden;
        this.onFieldsChanged();
        this.forceRendererChildren();
      }
    }
  };

  startSubscribe() {
    super.startSubscribe();
    this.conn.subscribe(`${this.key}.@b-hide`, this.hideListener, true);
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

  renderFields(): React.ReactNode[] {
    if (this.hidden) {
      return [];
    }
    return super.renderFields();
  }

  destroy() {
    this.conn.unsubscribe(`${this.key}.@b-hide`, this.hideListener);
    super.destroy();
  }

}

const fieldYOffset = 12;
const fieldHeight = 24;

export class BlockItem extends BaseBlockItem {

  h: number;

  setH(h: number) {
    if (h !== this.h) {
      this.h = h;
      for (let renderer of this._renderers) {
        renderer.renderH(h);
      }
      this.stage.onChildrenSizeChanged();
    }
  }

  selected: boolean = false;

  actualFields: string[] = [];

  setP(fields: string[]) {
    // in case actual fields changed but super.setP receive same array
    let forceRefresh = fields.length !== this.actualFields.length;

    this.actualFields = fields;
    let SpecialView = this.desc.view;
    if (!(this.synced  // synced block doesn't need extra #call item
      || fields.includes('#call')
      || (SpecialView && SpecialView.fullView) // fullView block doesn't need extra #call item
    )) {
      fields = fields.concat(['#call']);
    }
    super.setP(fields, forceRefresh);
  }

  getHeaderCallField(): FieldItem {
    if (this.fields !== this.actualFields) {
      return this.fieldItems.get('#call');
    }
    return null;
  }

  constructor(connection: ClientConnection, stage: Stage, key: string) {
    super(connection, stage, key);
  }

  startSubscribe() {
    super.startSubscribe();
    this.conn.subscribe(`${this.key}.#sync`, this.syncListener, true);
    this.conn.subscribe(`${this.key}.@b-xyw`, this.xywListener, true);
  }

  synced = false;
  syncListener = {
    onUpdate: (response: ValueUpdate) => {
      let newSynced = Boolean(response.cache.value);
      if (newSynced !== this.synced) {
        this.synced = newSynced;
        // update actual fields to add/remove #call
        this.setP(this.actualFields);
        this.forceUpdate();
      }
    }
  };

  xywListener = {
    onUpdate: (response: ValueUpdate) => {
      let {value} = response.cache;
      if (this.selected && this.stage.isDraggingBlock()) {
        // ignore xyw change from server during dragging
        return;
      }
      // TODO also protect width dragging?

      if (Array.isArray(value)) {
        this.setXYW(...value as [number, number, number]);
      } else if (typeof value === 'string') {
        this.setSyncParentKey(value);
      } else if (this.xyzInvalid) {
        this.setXYW(...this.stage.getNextXYW());
      }
    }
  };

  // height of special view area
  viewH: number = 0;
  setViewH = (h: number) => {
    if (h > 0 && h !== this.viewH) {
      this.viewH = h;
      this.conn.callImmediate(this.updateFieldPosition);
    }
  };

  forceRendererChildren() {
    this.forceUpdate();
    this.forceUpdateFields();
  }


  onFieldsChanged() {
    this.conn.callImmediate(this.updateFieldPosition);
    this.forceUpdate();
  }

  getRenderFields() {
    return this.actualFields;
  }

  setSelected(val: boolean) {
    if (val !== this.selected) {
      this.selected = val;
      this.forceUpdate();
      for (let field of this.fields) {
        this.fieldItems.get(field).forceUpdateWires(true);
      }
    }
  }

  setXYW(x: number, y: number, w: number, save = false) {
    if (!(x >= 0)) {
      x = 0;
    }
    if (!(y >= 0)) {
      y = 0;
    }
    if (x !== this.x || y !== this.y || w !== this.y) {
      this.x = x;
      this.y = y;
      if (Boolean(w) !== Boolean(this.w)) {
        this.w = w;
        this.forceUpdate();
      } else {
        this.w = w;
        for (let renderer of this._renderers) {
          renderer.renderXYW(x, y, w);
        }
      }
      this.updateFieldPosition();
      this.stage.onChildrenSizeChanged();
    }
    if (save) {
      this.conn.setValue(`${this.key}.@b-xyw`, [x, y, w]);
    } else {
      this.xyzInvalid = false;
    }
    if (this._syncChild) {
      this._syncChild.setXYW(this.x, this.y + this.h, this.w);
    }
  }

  updateFieldPosition = () => {
    let {x, y, w} = this;

    let SpecialView = this.desc.view;

    if (SpecialView && SpecialView.fullView) {
      this.setH(this.viewH); // footer height
    } else if (!w) {
      // minimized block
      let y1 = y + fieldYOffset;
      x -= 1;
      w = fieldHeight + 2;
      for (let field of this.fields) {
        this.fieldItems.get(field).updateFieldPos(x, y1, w, 0);
      }
      this.setH(fieldHeight);
    } else {
      let headerHeight = fieldHeight;
      if (this.desc.view) {
        // special view, right under the header
        headerHeight += this.viewH;
      }

      let y1 = y + 1; // top border;
      y1 += fieldYOffset;

      let headerCallField = this.getHeaderCallField();
      if (headerCallField) {
        headerCallField.updateFieldPos(x, y1, w, fieldHeight);
      }

      y1 += headerHeight;
      for (let field of this.getRenderFields()) {
        y1 = this.fieldItems.get(field).updateFieldPos(x, y1, w, fieldHeight);
      }
      this.setH(y1 - fieldYOffset + 20 - y); // footer height
    }
    if (this._syncChild) {
      this._syncChild.setXYW(this.x, this.y + this.h, this.w);
    }
  };

  onAttached() {
    this.startSubscribe();
  }

  onDetached() {
    this.destroy();
  }

  linkSyncParent(key: string) {
    this.conn.setValue(`${this.key}.@b-xyw`, key);
    this.conn.setBinding(`${this.key}.#call`, `${key}.#emit`, true);
    this.conn.setValue(`${this.key}.#sync`, true);
    this.setSyncParentKey(key);
  }

  unLinkSyncParent() {
    this.conn.setBinding(`${this.key}.#call`, null);
    this.conn.setValue(`${this.key}.#sync`, undefined);
    this.setSyncParentKey(null);
  }

  _syncParentKey: string;

  setSyncParentKey(key: string) {
    if (key === this._syncParentKey) {
      return;
    }
    if (this._syncParentKey) {
      this.stage.unlinkParentBlock(this._syncParentKey, this);
    }
    this._syncParentKey = key;
    if (key) {
      this.stage.linkParentBlock(key, this);
    } else {
      this.syncParent = null;
    }
  }

  _syncChild: BlockItem;
  _syncParent: BlockItem;
  set syncParent(parent: BlockItem) {
    // tslint:disable-next-line:triple-equals
    if (parent == this._syncParent) {
      return;
    }
    let oldParent = this._syncParent;
    this._syncParent = parent;
    if (oldParent && oldParent._syncChild === this) {
      oldParent.syncChild = null;
    }
    if (parent) {
      parent.syncChild = this;
    }
    //// nothing to refresh here for now
    // this.forceUpdate();
  }

  set syncChild(child: BlockItem) {
    // tslint:disable-next-line:triple-equals
    if (child == this._syncChild) {
      return;
    }
    let oldChild = this._syncChild;
    this._syncChild = child;
    if (oldChild && oldChild._syncParent === this) {
      oldChild.syncParent = null;
    }
    if (child) {
      child.syncParent = this;
      child.setXYW(this.x, this.y + this.h, this.w);
    }
    this.forceUpdate();
  }

  destroy() {
    this.conn.unsubscribe(`${this.key}.#sync`, this.syncListener);
    this.conn.unsubscribe(`${this.key}.@b-xyw`, this.xywListener);
    super.destroy();
  }
}