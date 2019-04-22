import React from "react";
import {ClientConnection, ValueUpdate, blankFuncDesc, getFuncStyleFromDesc, FunctionDesc, Block} from "../../core";
import {DataMap} from "../../core/util/Types";
import {PureDataRenderer} from "../../ui/component/DataRenderer";
import {TIcon} from "../icon/Icon";
import {DragDropDiv, DragState} from "rc-dock";
import {BaseBlockItem, BlockItem, Stage, XYWRenderer} from "./Field";


interface BlockViewProps {
  item: BlockItem;
}

interface BlockViewState {
  moving: boolean;
  footDropping: boolean;
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
      } else if (typeof value === 'string') {
        item.setSyncParentKey(value);
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

  selectAndDrag = (e: DragState) => {
    let {item} = this.props;
    if (e.event.ctrlKey) {
      item.stage.selectBlock(item.key, true);
    } else {
      item.stage.selectBlock(item.key);
    }
    if (item.selected) {
      let draggingBlocks = item.stage.startDragBlock(e);
      if (draggingBlocks.length === 1) {
        e.setData({moveBlock: item.key}, item.stage);
      }
      e.startDrag(null, null);
      this.setState({moving: true});
    }
  };
  onDragMove = (e: DragState) => {
    let {item} = this.props;
    if (item._syncParent && !item._syncParent.selected && e.moved()) {
      item.unLinkSyncParent();
    }
    this.props.item.stage.onDragBlockMove(e);
  };
  onDragEnd = (e: DragState) => {
    this.props.item.stage.onDragBlockEnd(e);
    this.setState({moving: false});
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

  startDragW = (e: DragState) => {
    let {item} = this.props;
    this._baseW = item.w;
    e.startDrag(null, null);
  };

  onDragWMove = (e: DragState) => {
    let {item} = this.props;
    let newW = this._baseW + e.dx;
    if (!(newW > 80)) {
      newW = 80;
    }
    if (newW !== item.w) {
      item.setXYW(item.x, item.y, newW, true);
    }
  };

  onDragWEnd = (e: DragState) => {
    this._baseW = -1;
  };

  onDragOverFoot = (e: DragState) => {
    let {item} = this.props;
    if (item._syncChild) {
      return;
    }
    let movingBlockKey: string = DragState.getData('moveBlock', item.stage);
    if (movingBlockKey && movingBlockKey !== item.key) {
      e.accept('');
      this.setState({footDropping: true});
    }
  };
  onDropFoot = (e: DragState) => {
    let {item} = this.props;
    let movingBlockKey: string = DragState.getData('moveBlock', item.stage);
    if (movingBlockKey && movingBlockKey !== item.key) {
      let block = item.stage.getBlock(movingBlockKey);
      if (block) {
        block.linkSyncParent(item.key);
      }
    }
  };
  onDragLeaveFoot = (e: DragState) => {
    this.setState({footDropping: false});
  };

  constructor(props: BlockViewProps) {
    super(props);
    this.state = {moving: false, footDropping: false};
    let {item} = props;
    item.conn.subscribe(`${item.key}.@b-xyw`, this.xywListener, true);
  }

  renderImpl() {
    let {item} = this.props;
    let {moving} = this.state;
    let SpecialView = item.desc.view;

    let classNames: string[] = [];
    if (item.selected) {
      classNames.push('ticl-block-selected');
    }
    if (item.synced) {
      classNames.push('ticl-block-synced');
    }
    if (item._syncChild) {
      classNames.push('ticl-block-sync-parent');
    }
    if (moving) {
      classNames.push('ticl-block-moving');
    }
    if (SpecialView && SpecialView.fullView) {
      classNames.push('ticl-block-full-view');
      return (
        <DragDropDiv className={classNames.join(' ')}
                     getRef={this.getRef} style={{top: item.y, left: item.x, width: item.w}}
                     onDragStartT={this.selectAndDrag} onDragMoveT={this.onDragMove} onDragEndT={this.onDragEnd}>
          <SpecialView conn={item.conn} path={item.key}/>
          <DragDropDiv className='ticl-width-drag'
                       onDragStartT={this.startDragW} onDragMoveT={this.onDragWMove} onDragEndT={this.onDragWEnd}/>
        </DragDropDiv>
      );
    } else if (item.w) {
      classNames.push('ticl-block');
      classNames.push(getFuncStyleFromDesc(item.desc));
      return (
        <div
          ref={this.getRef}
          className={classNames.join(' ')}
          style={{top: item.y, left: item.x, width: item.w}}
        >
          <DragDropDiv className='ticl-block-head ticl-block-prbg' directDragT={true} onDoubleClick={this.expandBlock}
                       onDragStartT={this.selectAndDrag} onDragMoveT={this.onDragMove} onDragEndT={this.onDragEnd}>
            <TIcon icon={item.desc.icon}/>
            {item.name}
          </DragDropDiv>
          {
            SpecialView ?
              <div className='ticl-block-view'>
                <SpecialView conn={item.conn} path={item.key} updateViewHeight={item.setViewH}/>
              </div>
              : null
          }
          <div className='ticl-block-body'>
            {item.renderFields()}
          </div>
          <DragDropDiv className='ticl-block-foot'
                       onDragOverT={this.onDragOverFoot} onDropT={this.onDropFoot} onDragLeaveT={this.onDragLeaveFoot}>
            <DragDropDiv className='ticl-width-drag'
                         onDragStartT={this.startDragW} onDragMoveT={this.onDragWMove} onDragEndT={this.onDragWEnd}/>
          </DragDropDiv>
        </div>
      );
    } else if (item.descLoaded) {
      classNames.push('ticl-block');
      classNames.push('ticl-block-min');
      classNames.push(getFuncStyleFromDesc(item.desc));
      return (
        <div
          ref={this.getRef}
          className={classNames.join(' ')}
          style={{top: item.y, left: item.x}}
        >
          <div className='ticl-block-min-bound'/>
          <DragDropDiv className='ticl-block-head ticl-block-prbg' directDragT={true} onDoubleClick={this.expandBlock}
                       onDragStartT={this.selectAndDrag} onDragMoveT={this.onDragMove} onDragEndT={this.onDragEnd}>
            <TIcon icon={item.desc.icon}/>
          </DragDropDiv>
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
