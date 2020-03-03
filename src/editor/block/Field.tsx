import React, {MouseEventHandler} from 'react';
import {WireItem} from './Wire';
import {DataRendererItem, PureDataRenderer} from '../component/DataRenderer';
import {
  getRelativePath,
  resolvePath,
  translateProperty,
  ClientConn,
  ValueUpdate,
  blankFuncDesc,
  blankPropDesc,
  buildPropDescCache,
  findPropDesc,
  FunctionDesc,
  PropDesc,
  PropGroupDesc,
  arrayEqual,
  deepEqual,
  ValueSubscriber
} from '../../../src/core/editor';
import {TIcon} from '../icon/Icon';
import {DragDropDiv, DragState} from 'rc-dock';
import * as DragManager from 'rc-dock/src/dragdrop/DragManager';
import {FieldValue} from './FieldValue';

export interface Stage {
  getBlock(path: string): BlockItem;

  getNextXYW(): [number, number, number];

  linkParentBlock(parentPath: string, targetBlock: BlockItem): void;

  unlinkParentBlock(parentPath: string, targetBlock: BlockItem): void;

  linkField(sourcePath: string, targetField: FieldItem): void;

  unlinkField(sourcePath: string, targetField: FieldItem): void;

  registerField(path: string, item: FieldItem): void;

  unregisterField(path: string, item: FieldItem): void;

  forceUpdate(): void;

  selectBlock(path: string, ctrl?: boolean): void;

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

export class FieldItem extends DataRendererItem {
  block: BaseBlockItem;
  name: string;
  path: string;
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
  _bindingTargetPath?: string;

  setBindingPath(str: string) {
    if (str !== this._bindingPath) {
      if (this._bindingTargetPath) {
        this.block.stage.unlinkField(this._bindingTargetPath, this);
      }
      if (this.subBlock) {
        // subBlock can only exist on one binding path, it always disappears when binding path change
        this.subBlock.destroy();
        this.subBlock = null;
        this.block.onFieldsChanged();
      }
      this._bindingPath = str;
      this._bindingTargetPath = resolvePath(this.block.path, this._bindingPath);

      if (this._bindingTargetPath) {
        if (this._bindingPath === `~${this.name}.#output`) {
          // binding block
          this.subBlock = new SubBlockItem(this.block.conn, this.block.stage, `${this.block.path}.~${this.name}`, this);
          this.removeInWire();
        } else {
          // binding wire
          this.block.stage.linkField(this._bindingTargetPath, this);
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
  getBaseConn() {
    return this.block.conn.getBaseConn();
  }
  cache: any = {};
  listener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let change = response.change;
      if (!deepEqual(response.cache, this.cache)) {
        this.cache = response.cache;
        if (
          (change.hasOwnProperty('bindingPath') && this.setBindingPath(response.cache.bindingPath)) ||
          change.hasOwnProperty('hasListener')
        ) {
          this.forceUpdate();
        }
      }
    }
  });

  constructor(block: BaseBlockItem, name: string) {
    super();
    this.name = name;
    this.block = block;
    this.path = `${block.path}.${name}`;
    this.listener.subscribe(this.block.conn, this.path);
    this.block.stage.registerField(this.path, this);
  }

  destroy() {
    this.listener.unsubscribe();
    this.block.stage.unregisterField(this.path, this);
    if (this._bindingTargetPath) {
      this.block.stage.unlinkField(this._bindingTargetPath, this);
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
      this.forceUpdate();
      this.block.stage.forceUpdate();
    }
  }

  render(): React.ReactNode {
    if (this.subBlock) {
      return (
        <div key={this.path} className="ticl-field-subblock">
          <FieldView key={this.path} item={this} />
          {this.subBlock.renderFields()}
        </div>
      );
    } else {
      return <FieldView key={this.path} item={this} />;
    }
  }

  sourceChanged(source: FieldItem, partial = false) {
    if (source) {
      if (this.inWire) {
        if (partial && source.path.length < this.inWire.source.path.length) {
          // already has a better link
          return;
        }
        this.inWire.setSource(source);
      } else {
        this.inWire = new WireItem(source, this);
        this.forceUpdate();
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
  shared: boolean;
  onDragStartT?: DragManager.DragHandler;
  onDragMoveT?: DragManager.DragHandler;
  onDragEndT?: DragManager.DragHandler;
  onDoubleClick?: MouseEventHandler;
}

export class BlockHeaderView extends PureDataRenderer<BlockHeaderProps, any> {
  onDragOver = (e: DragState) => {
    let {item} = this.props;
    if (e.dragType !== 'right') {
      let fields: string[] = DragState.getData('fields', item.getBaseConn());
      if (Array.isArray(fields)) {
        if (!item.desc.readonly && fields.length === 1 && fields[0] !== item.path) {
          e.accept('tico-fas-play');
          return;
        }
      }
    }
  };
  onDrop = (event: DragState) => {
    let {item} = this.props;
    if (event.dragType !== 'right') {
      let fields: string[] = DragState.getData('fields', item.getBaseConn());
      if (Array.isArray(fields) && fields.length === 1 && fields[0] !== item.path) {
        item.getConn().setBinding(item.path, fields[0], true);
      }
    }
  };

  renderImpl(): React.ReactNode {
    let {item, shared, onDragStartT, onDragMoveT, onDragEndT, onDoubleClick, children} = this.props;
    let inBoundClass: string;
    let inBoundText: string;
    let inBoundTitle: string;
    let showOutBound = false;

    if (item) {
      showOutBound = item.cache.hasListener || (item.subBlock && item.subBlock.hidden);
      if (item.cache.bindingPath) {
        inBoundClass = 'ticl-slot ticl-inbound';
        if (item.subBlock) {
          inBoundClass = null;
        } else if (item.inWire) {
          inBoundTitle = item.cache.bindingPath;
          if (item.inWire.checkIsRightSide()) {
            inBoundClass = 'ticl-slot ticl-inbound-right';
            showOutBound = false;
          }
        } else {
          inBoundClass += ' ticl-inbound-path';
          inBoundText = item.cache.bindingPath;
        }
      }
    }
    let className = 'ticl-block-head ticl-block-prbg';
    if (shared) {
      className = `${className} ticl-block-head-shared`;
    }

    return (
      <DragDropDiv
        className={className}
        directDragT={true}
        onDoubleClick={onDoubleClick}
        onDragStartT={onDragStartT}
        onDragMoveT={onDragMoveT}
        onDragEndT={onDragEndT}
        onDragOverT={item ? this.onDragOver : null}
        onDropT={item ? this.onDrop : null}
      >
        {inBoundClass ? (
          <div className={inBoundClass} title={inBoundTitle}>
            {inBoundText}
          </div>
        ) : null}
        {showOutBound ? <div className="ticl-outbound" /> : null}
        {item && item.subBlock ? (
          <div className="ticl-field-subicon ticl-block-prbg">
            <TIcon icon={item.subBlock.desc.icon} />
          </div>
        ) : null}
        {children}
      </DragDropDiv>
    );
  }
}

export class FieldView extends PureDataRenderer<FieldViewProps, any> {
  onDragStart = (e: DragState) => {
    let {item} = this.props;
    if (e.dragType === 'right') {
      e.setData({moveShownField: item.name, block: item.block}, item.getBaseConn());
    } else {
      e.setData({fields: [item.path]}, item.getBaseConn());
    }

    e.startDrag();
  };
  onDragOver = (e: DragState) => {
    let {item} = this.props;
    if (e.dragType === 'right') {
      let moveShownField = DragState.getData('moveShownField', item.getBaseConn());
      let block = DragState.getData('block', item.getBaseConn());
      if (block === item.block && moveShownField !== item.name) {
        e.accept('tico-fas-exchange-alt');
        return;
      }
    } else {
      let fields: string[] = DragState.getData('fields', item.getBaseConn());
      if (Array.isArray(fields)) {
        if (!item.desc.readonly && fields.length === 1 && fields[0] !== item.path) {
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
      let moveShownField = DragState.getData('moveShownField', item.getBaseConn());
      let block = DragState.getData('block', item.getBaseConn());
      if (block === item.block) {
        item.getConn().moveShownProp(block.path, moveShownField, item.name);
      }
    } else {
      let fields: string[] = DragState.getData('fields', item.getBaseConn());
      if (Array.isArray(fields) && fields.length === 1 && fields[0] !== item.path) {
        item.getConn().setBinding(item.path, fields[0], true);
      }
    }
  };

  onNameDoubleClick = (event: React.MouseEvent) => {
    let {item} = this.props;
    if (item.subBlock) {
      item.getConn().setValue(`${item.subBlock.path}.@b-hide`, item.subBlock.hidden ? undefined : true);
    }
  };

  renderImpl(): React.ReactNode {
    let {item} = this.props;
    let desc = item.block.desc;

    let showOutBound = item.cache.hasListener || (item.subBlock && item.subBlock.hidden);

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
        if (item.inWire.checkIsRightSide()) {
          inBoundClass = 'ticl-slot ticl-inbound-right';
          showOutBound = false;
        }
      } else {
        inBoundClass += ' ticl-inbound-path';
        inBoundText = item.cache.bindingPath;
      }
    } else if (item.desc.readonly) {
      inBoundClass = null;
    }
    let indentChildren = [];
    for (let i = 0; i < item.indents.length; ++i) {
      indentChildren.push(<div key={i} className={`ticl-field-indent${item.indents[i]}`} />);
    }

    return (
      <DragDropDiv
        className={fieldClass}
        onDragStartT={this.onDragStart}
        useRightButtonDragT={true}
        onDragOverT={this.onDragOver}
        onDropT={this.onDrop}
      >
        {inBoundClass ? (
          <div className={inBoundClass} title={inBoundTitle}>
            {inBoundText}
          </div>
        ) : null}
        {showOutBound ? <div className="ticl-outbound" /> : null}
        {indentChildren}
        <div className="ticl-field-name" onDoubleClick={this.onNameDoubleClick}>
          {item.subBlock ? (
            <div className="ticl-field-subicon ticl-block-prbg" style={{left: item.indents.length * 18}}>
              <TIcon icon={item.subBlock.desc.icon} />
            </div>
          ) : null}
          {translateProperty(desc.name, item.name, desc.ns)}
        </div>
        <FieldValue conn={item.getConn()} path={item.path} />
      </DragDropDiv>
    );
  }
}

export interface XYWRenderer {
  renderXYW(x: number, y: number, z: number): void;

  renderH(h: number): void;
}

export abstract class BaseBlockItem extends DataRendererItem<XYWRenderer> {
  conn: ClientConn;
  x: number = 0;
  y: number = 0;
  w: number = 0;
  xyzInvalid = true;

  name: string;
  desc: FunctionDesc = blankFuncDesc;
  custom: (PropDesc | PropGroupDesc)[];
  propDescCache: {[key: string]: PropDesc};
  fields: string[] = [];
  fieldItems: Map<string, FieldItem> = new Map<string, FieldItem>();

  getRenderFields() {
    return this.fields;
  }

  abstract get selected(): boolean;

  constructor(connection: ClientConn, public stage: Stage, public path: string) {
    super();
    this.conn = connection;
    this.name = path.substr(path.lastIndexOf('.') + 1);
  }

  // renderer both the block and children fields
  abstract forceRendererChildren(): void;

  abstract onFieldsChanged(): void;

  isValue: string;
  isListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let {value} = response.cache;
      if (typeof value === 'string') {
        this.isValue = value;
        this.conn.watchDesc(value, this.descListener);
      } else {
        this.isValue = null;
        this.conn.unwatchDesc(this.descListener);
      }
    },
    onError: (err: string) => {
      if (this.isValue != null) {
        // source changed. re-watch
        this.isValue = null;
        this.destroy();
        this.startSubscribe();
      }
    }
  });
  customListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let value = response.cache.value;
      if (!Array.isArray(value)) {
        value = null;
      }
      if (!deepEqual(value, this.custom)) {
        this.custom = value;
        this.updatePropCache();
      }
    }
  });
  pListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let {value} = response.cache;
      if (Array.isArray(value)) {
        this.setP(value);
      }
    }
  });

  descLoaded = false;
  descListener = (funcDesc: FunctionDesc) => {
    this.setDesc(funcDesc || blankFuncDesc);
    this.descLoaded = true;
  };

  startSubscribe() {
    this.isListener.subscribe(this.conn, `${this.path}.#is`, true);
    this.customListener.subscribe(this.conn, `${this.path}.#custom`, true);
    this.pListener.subscribe(this.conn, `${this.path}.@b-p`, true);
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
    this.propDescCache = buildPropDescCache(this.desc, this.custom);
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
    this.isListener.unsubscribe();
    this.customListener.unsubscribe();
    this.pListener.unsubscribe();
    this.conn.unwatchDesc(this.descListener);
    for (let [, fieldItem] of this.fieldItems) {
      fieldItem.destroy();
    }
    this.fieldItems.clear();
    this.fields = [];
  }

  getConn() {
    return this.conn;
  }
}

class SubBlockItem extends BaseBlockItem {
  parentField: FieldItem;

  constructor(connection: ClientConn, stage: Stage, path: string, field: FieldItem) {
    super(connection, stage, path);
    this.parentField = field;
    this.startSubscribe();
  }

  hidden = true;
  hideListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let hidden = Boolean(response.cache.value);
      if (hidden !== this.hidden) {
        this.hidden = hidden;
        this.onFieldsChanged();
        this.forceRendererChildren();
      }
    }
  });

  startSubscribe() {
    super.startSubscribe();
    this.hideListener.subscribe(this.conn, `${this.path}.@b-hide`, true);
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
    this.hideListener.unsubscribe();
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
    let FullView = this.desc.view;
    if (
      !(
        this._syncParent || // sync child block doesn't need extra #call item
        fields.includes('#call') ||
        FullView
      ) // fullView block doesn't need extra #call item
    ) {
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

  constructor(connection: ClientConn, stage: Stage, path: string, public shared?: boolean) {
    super(connection, stage, path);
  }

  startSubscribe() {
    super.startSubscribe();
    this.syncListener.subscribe(this.conn, `${this.path}.#sync`, true);
    this.xywListener.subscribe(this.conn, `${this.path}.@b-xyw`, true);
  }

  synced = false;
  syncListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let newSynced = Boolean(response.cache.value);
      if (newSynced !== this.synced) {
        this.synced = newSynced;
        this.forceUpdate();
      }
    }
  });

  xywListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let {value} = response.cache;
      if (this.selected && this.stage.isDraggingBlock()) {
        // ignore xyw change from server during dragging
        return;
      }
      // TODO also protect width dragging?

      if (Array.isArray(value)) {
        this.setXYW(...(value as [number, number, number]));
      } else if (typeof value === 'string') {
        this.setSyncParentPath(this.path.replace(/[^.]+$/, value));
      } else if (this.xyzInvalid) {
        this.setXYW(...this.stage.getNextXYW());
      }
    }
  });

  // height of special view area
  viewH: number = 0;
  setViewH = (h: number) => {
    if (h !== this.viewH && h > 0) {
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
      this.conn.setValue(`${this.path}.@b-xyw`, [x, y, w]);
    } else {
      this.xyzInvalid = false;
    }
    if (this._syncChild) {
      this._syncChild.setXYW(this.x, this.y + this.h, this.w);
    }
  }

  updateFieldPosition = () => {
    let {x, y, w} = this;

    let FullView = this.desc.view;

    if (FullView) {
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

      // special view, right under the header
      headerHeight += this.viewH;

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

  linkSyncParent(parent: BlockItem) {
    if (parent.stage === this.stage) {
      this.conn.setValue(`${this.path}.@b-xyw`, parent.name);
      this.conn.setBinding(`${this.path}.#call`, `${parent.path}.#emit`, true);
      this.conn.setValue(`${this.path}.#sync`, true);
      this.setSyncParentPath(parent.path);
    }
  }

  unLinkSyncParent() {
    this.conn.setBinding(`${this.path}.#call`, null);
    this.conn.setValue(`${this.path}.#sync`, undefined);
    this.setSyncParentPath(null);
  }

  _syncParentPath: string;

  setSyncParentPath(parentPath: string) {
    if (parentPath === this._syncParentPath) {
      return;
    }
    if (this._syncParentPath) {
      this.stage.unlinkParentBlock(this._syncParentPath, this);
    }
    this._syncParentPath = parentPath;
    if (parentPath) {
      this.stage.linkParentBlock(parentPath, this);
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
    // update actual fields to add/remove #call
    this.setP(this.actualFields);
    this.forceUpdate();
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
    this.syncListener.unsubscribe();
    this.xywListener.unsubscribe();
    super.destroy();
    this.actualFields = [];
  }
}
