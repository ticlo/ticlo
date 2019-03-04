import React from "react";
import {ClientConnection, ValueUpdate, blankFuncDesc, getFuncStyleFromDesc, FunctionDesc} from "../../common";
import {DataMap} from "../../common/util/Types";
import {PureDataRenderer} from "../../ui/component/DataRenderer";
import {TIcon} from "../icon/Icon";
import {AbstractPointerEvent, DragInitFunction, DragInitiator} from "../../ui/component/DragHelper";
import {BaseBlockItem, Stage, XYWRenderer} from "./Field";

const fieldYOffset = 12;
const fieldHeight = 24;

export class BlockItem extends BaseBlockItem {
  // height of special view area
  viewH: number = 0;
  h: number;
  selected: boolean = false;

  constructor(connection: ClientConnection, stage: Stage, key: string) {
    super(connection, stage, key);
  }

  forceRendererChildren() {
    this.forceUpdate();
    this.forceUpdateFields();
  }


  onFieldsChanged() {
    this.conn.callImmediate(this.updateFieldPosition);
    this.forceUpdate();
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
    }
    if (save) {
      this.conn.setValue(`${this.key}.@b-xyw`, [x, y, w]);
    }
  }

  updateFieldPosition = () => {
    let {x, y, w} = this;


    if (!w) {
      let y1 = y + fieldYOffset;
      x -= 1;
      w = fieldHeight + 2;
      for (let field of this.fields) {
        this.fieldItems.get(field).updateFieldPos(x, y1, w, 0);
      }
      this.h = fieldHeight;
    } else {
      let headerHeight = fieldHeight;
      if (this.desc.view === 'top') {
        // special view, right under the header
        headerHeight += this.viewH;
      }

      let y1 = y + 1; // top border;
      y1 += fieldYOffset;
      y1 += headerHeight;
      for (let field of this.fields) {
        y1 = this.fieldItems.get(field).updateFieldPos(x, y1, w, fieldHeight);
      }
      this.h = y1 - fieldYOffset + 20 - y; // footer height
    }
  };

  onAttached() {
    this.startSubscribe();
  }

  onDetached() {
    this.destroy();
  }
}

interface BlockViewProps {
  item: BlockItem;
}

interface BlockViewState {

}

export class BlockView extends PureDataRenderer<BlockViewProps, BlockViewState> implements XYWRenderer {
  private _rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this._rootNode = node;
  };

  xywListener = {
    onUpdate: (response: ValueUpdate) => {
      let {value} = response.cache;
      let {item} = this.props;
      if (item.selected && item.stage.isDraggingBlock()) {
        // ignore xyw change from server during dragging
        return;
      }
      if (this.isDraggingW()) {
        // ignore xyw change during width dragging
        return;
      }
      if (Array.isArray(value)) {
        item.setXYW(...value as [number, number, number]);
      }
    }
  };

  renderXYW(x: number, y: number, w: number) {
    this._rootNode.style.left = `${x}px`;
    this._rootNode.style.top = `${y}px`;
    if (w) {
      this._rootNode.style.width = `${w}px`;
    }
  }

  selectAndDrag = (e: PointerEvent, initFunction: DragInitFunction) => {
    let {item} = this.props;
    if (e.ctrlKey) {
      item.stage.selectBlock(item.key, true);
    } else {
      item.stage.selectBlock(item.key);
    }
    if (item.selected) {
      item.stage.startDragBlock(e, initFunction);
    }
  };

  expandBlock = (e: React.MouseEvent) => {
    let {item} = this.props;
    if (item.selected && item.stage.isDraggingBlock()) {
      // ignore xyw change from server during dragging
      return;
    }
    if (this.isDraggingW()) {
      // ignore xyw change during width dragging
      return;
    }
    if (item.w) {
      item.setXYW(item.x, item.y, 0);
    } else {
      item.setXYW(item.x, item.y, 150);
    }
  };

  _baseW: number = -1;

  isDraggingW() {
    return this._baseW >= 0;
  }

  startDragW = (e: PointerEvent, initFunction: DragInitFunction) => {
    let {item} = this.props;

    this._baseW = item.w;
    initFunction(item.stage.getRefElement(), this.onDragWMove, this.onDragWEnd);
  };

  onDragWMove = (e: AbstractPointerEvent, dx: number, dy: number) => {
    let {item} = this.props;
    let newW = this._baseW + dx;
    if (!(newW > 80)) {
      newW = 80;
    }
    if (newW !== item.w) {
      item.setXYW(item.x, item.y, newW, true);
    }
  };

  onDragWEnd = (e: AbstractPointerEvent, dx: number, dy: number) => {
    this._baseW = -1;
  };


  constructor(props: BlockViewProps) {
    super(props);
    this.state = {funcDesc: blankFuncDesc};
    let {item} = props;
    item.conn.subscribe(`${item.key}.@b-xyw`, this.xywListener, true);
  }

  renderImpl() {
    let {item} = this.props;
    let SpecialView = item.desc.view;

    if (SpecialView && SpecialView.fullView) {
      return (
        <DragInitiator className={`ticl-block-full-view${item.selected ? ' ticl-block-selected' : ''}`}
                       getRef={this.getRef}
                       onDragInit={this.selectAndDrag} style={{top: item.y, left: item.x, width: item.w}}>
          <SpecialView conn={item.conn} path={item.key}/>
        </DragInitiator>
      );
    } else if (item.w) {
      return (
        <div
          ref={this.getRef}
          className={`ticl-block ${getFuncStyleFromDesc(item.desc)}${item.selected ? ' ticl-block-selected' : ''}`}
          style={{top: item.y, left: item.x, width: item.w}}
        >
          <DragInitiator className='ticl-block-head ticl-block-prbg' onDragInit={this.selectAndDrag}
                         onDoubleClick={this.expandBlock}>
            <TIcon icon={item.desc.icon}/>
            {item.name}
          </DragInitiator>
          <div className='ticl-block-body'>
            {item.renderFields()}
          </div>
          <div className='ticl-block-foot'>
            <DragInitiator className='ticl-width-drag' onDragInit={this.startDragW}/>
          </div>
        </div>
      );
    } else if (item.descLoaded) {
      return (
        <div
          ref={this.getRef}
          className={`ticl-block ticl-block-min ${getFuncStyleFromDesc(item.desc)}${item.selected ? ' ticl-block-selected' : ''}`}
          style={{top: item.y, left: item.x}}
        >
          <div className='ticl-block-min-bound'/>
          <DragInitiator className='ticl-block-head ticl-block-prbg' onDragInit={this.selectAndDrag}
                         onDoubleClick={this.expandBlock}>
            <TIcon icon={item.desc.icon}/>
          </DragInitiator>
        </div>
      );

    } else {
      // data not ready, don't renderer
      return <div ref={this.getRef}/>;
    }
  }

  componentWillUnmount() {
    let {item} = this.props;
    item.conn.unsubscribe(`${item.key}.@b-xyw`, this.xywListener);
    super.componentWillUnmount();
  }
}
