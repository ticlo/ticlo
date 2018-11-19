import React from "react";
import {ClientConnection} from "../../common/connect/ClientConnection";
import {DataMap} from "../../common/util/Types";
import {DataRendererItem, PureDataRenderer} from "../../ui/component/DataRenderer";
import {TIcon} from "../icon/Icon";
import {FunctionDesc} from "../../common/block/Descriptor";
import {compareArray} from "../../common/util/Compare";
import {translateProperty} from "../../common/util/i18n";
import equal from "fast-deep-equal";
import {toDisplay} from "../../ui/util/Types";
import {WireItem} from "./Wire";
import {resolve} from "../../common/util/Path";

const fieldHeight = 24;
const fieldYOffset = 12;

export interface Stage {
  linkField(sourceKey: string, targetField: FieldItem): void;

  unlinkField(sourceKey: string, targetField: FieldItem): void;

  registerField(key: string, item: FieldItem): void;

  unregisterField(key: string, item: FieldItem): void;

  forceUpdate(): void;

  selectBlock(key: string, ctrl?: boolean, drag?: boolean): boolean;
}

export class FieldItem extends DataRendererItem {
  block: BlockItem;
  name: string;
  key: string;

  bindBlock?: BlockItem;

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
      this._bindingPath = str;
      if (this._bindingPath) {
        this.block.stage.linkField(resolve(this.block.key, this._bindingPath), this);
      }
    }
  }

  // return y pos of next field
  setXYW(x: number, y: number, w: number): number {
    if (x !== this.x || y !== this.y || w !== this.y) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.forceUpdate();
      if (this.inWire) {
        this.inWire.forceUpdate();
      }
      for (let outWire of this.outWires) {
        outWire.forceUpdate();
      }
      // TODO update bindBlock
    }
    return y + fieldHeight;
  }

  conn() {
    return this.block.conn;
  }

  cache: any = {};
  listener = {
    onUpdate: (response: DataMap) => {
      if (!equal(response.cache, this.cache)) {
        this.cache = response.cache;
        this.setBindingPath(this.cache.bindingPath);
        this.forceUpdate();
      }
    }
  };

  constructor(block: BlockItem, name: string) {
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
  }

  render(): React.ReactNode {
    return <FieldView key={this.key} item={this}/>;
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
      }
    }
  }
}

export class BlockItem extends DataRendererItem {
  conn: ClientConnection;
  stage: Stage;
  x: number = 0;
  y: number = 0;
  w: number = 0;
  h: number = 0;
  key: string;
  name: string;
  desc: FunctionDesc = defaultFuncDesc;
  fields: string[] = [];
  fieldItems: Map<string, FieldItem> = new Map<string, FieldItem>();
  selected: boolean = false;

  constructor(connection: ClientConnection, stage: Stage, key: string) {
    super();
    this.conn = connection;
    this.stage = stage;
    this.key = key;
    this.name = key.substr(key.indexOf('.') + 1);
  }

  setDesc(desc: FunctionDesc) {
    if (desc !== this.desc) {
      this.desc = desc;
      this.forceUpdate();
      this.forceUpdateFields();
    }
  }

  setSelected(val: boolean) {
    if (val !== this.selected) {
      this.selected = val;
      this.forceUpdate();
    }
  }

  setXYW(x: number, y: number, w: number) {
    if (x !== this.x || y !== this.y || w !== this.y) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.forceUpdate();
      this.updateFieldPosition();
    }
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
          this.fieldItems.set(f, new FieldItem(this, f));
        }
      }
      this.forceUpdate();
      this.updateFieldPosition();
    }
  }

  forceUpdateFields() {
    for (let [key, item] of this.fieldItems) {
      item.forceUpdate();
    }
  }

  updateFieldPosition() {
    let {x, y, w} = this;

    if (!w) {
      y += fieldYOffset;
      x -= 4;
      w = fieldHeight + 5;
      for (let field of this.fields) {
        this.fieldItems.get(field).setXYW(x, y, w);
      }
      this.h = fieldHeight;
    } else {
      y += 1; // top border;
      y += fieldYOffset;
      y += fieldHeight;
      for (let field of this.fields) {
        y = this.fieldItems.get(field).setXYW(x, y, w);
      }
      this.h = y - fieldYOffset + 20; // footer height
    }
  }

  renderFields(): React.ReactNode[] {
    let result: React.ReactNode[] = [];
    for (let field of this.fields) {
      result.push(this.fieldItems.get(field).render());
    }
    return result;
  }

  onDetached() {
    for (let [key, fieldItem] of this.fieldItems) {
      fieldItem.destructor();
    }
  }
}

interface FieldViewProps {
  item: FieldItem;
}

interface FieldViewState {
}


export class FieldView extends PureDataRenderer<FieldViewProps, FieldViewState> {

  render(): React.ReactNode {
    let {item} = this.props;
    let desc = item.block.desc;
    return (
      <div className='ticl-block-field'>
        <div className='ticl-block-field-name'>{translateProperty(desc.name, item.name, desc.ns)}</div>
        <div className='ticl-block-field-value'>{toDisplay(item.cache.value)}</div>
        <div className='ticl-inbound'/>
        {(item.cache.hasListener) ? <div className='ticl-outbound'/> : null}
      </div>
    );
  }
}


interface BlockViewProps {
  item: BlockItem;
}

interface BlockViewState {

}

const defaultFuncDesc = {
  name: '',
  icon: ''
};


export class BlockView extends PureDataRenderer<BlockViewProps, BlockViewState> {
  isListener = {
    onUpdate: (response: DataMap) => {
      let {value} = response.cache;
      let {item} = this.props;
      if (typeof value === 'string') {
        item.conn.watchDesc(value, this.descListener);
      }
    }
  };
  xywListener = {
    onUpdate: (response: DataMap) => {
      let {value} = response.cache;
      let {item} = this.props;
      if (Array.isArray(value)) {
        item.setXYW(...value as [number, number, number]);
      }
    }
  };
  pListener = {
    onUpdate: (response: DataMap) => {
      let {value} = response.cache;
      if (Array.isArray(value)) {
        this.props.item.setP(value);
      }
    }
  };
  descListener = (funcDesc: FunctionDesc) => {
    let {item} = this.props;
    if (funcDesc) {
      item.setDesc(funcDesc);
    } else {
      item.setDesc(defaultFuncDesc);
    }
  };
  onHeaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    let {item} = this.props;
    if (e.ctrlKey) {
      item.stage.selectBlock(item.key, true);
    } else {
      item.stage.selectBlock(item.key);
    }
  };
  onHeaderDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    let {item} = this.props;
    if (item.stage.selectBlock(item.key, false, true)) {
      // TODO custom drag
      // drag starts if block is selected
      // when there is no block selected, the current block is automatically selected
    }

  };

  constructor(props: BlockViewProps) {
    super(props);
    this.state = {funcDesc: defaultFuncDesc};
    let {item} = props;
    item.conn.subscribe(`${item.key}.#is`, this.isListener);
    item.conn.subscribe(`${item.key}.@b-xyw`, this.xywListener);
    item.conn.subscribe(`${item.key}.@b-p`, this.pListener);
  }

  getFuncStyle(): string {
    let {style, priority} = this.props.item.desc;
    if (style) {
      return 'ticl-block-pr' + style.substr(0, 1);
    }
    if (priority > -1) {
      return 'ticl-block-pr' + priority;
    }
    return '';
  }

  render() {
    let {item} = this.props;
    if (item.w) {
      return (
        <div
          className={`ticl-block ${this.getFuncStyle()}${item.selected ? ' ticl-block-selected' : ''}`}
          style={{top: item.y, left: item.x, width: item.w}}
        >
          <div className='ticl-block-head ticl-block-prbg' onClick={this.onHeaderClick}
               onDragStart={this.onHeaderDragStart} draggable={true}>
            <TIcon icon={item.desc.icon}/>
            {item.name}
          </div>
          <div className='ticl-block-body'>
            {item.renderFields()}
          </div>
          <div className='ticl-block-foot'/>
        </div>
      );
    } else {
      return (
        <div
          className={`ticl-block ticl-block-min ${this.getFuncStyle()}${item.selected ? ' ticl-block-selected' : ''}`}
          style={{top: item.y, left: item.x}}
        >
          <div className='ticl-block-min-bound'/>
          <div className='ticl-block-head ticl-block-prbg' onClick={this.onHeaderClick}
               onDragStart={this.onHeaderDragStart} draggable={true}>
            <TIcon icon={item.desc.icon}/>
          </div>
        </div>
      );

    }
  }

  componentWillUnmount() {
    let {item} = this.props;
    item.conn.unsubscribe(`${item.key}.#is`, this.isListener);
    item.conn.unsubscribe(`${item.key}.@b-xyw`, this.xywListener);
    item.conn.unsubscribe(`${item.key}.@b-p`, this.pListener);
    item.conn.unwatchDesc(this.descListener);
  }
}

