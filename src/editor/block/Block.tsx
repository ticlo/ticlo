import React from 'react';
import {PureDataRenderer} from '../component/DataRenderer';
import {TIcon} from '../icon/Icon';
import {DragDropDiv, DragState} from 'rc-dock';
import {BaseBlockItem, BlockHeaderView, BlockItem, Stage, XYWRenderer} from './Field';
import {LazyUpdateSubscriber} from '../component/LazyUpdateComponent';
import {BlockWidget} from './view/BlockWidget';
import {getFuncStyleFromDesc} from '../util/BlockColors';
import {getDisplayName} from '../../core';
import {Tooltip} from 'antd';

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

  renderXYW(x: number, y: number, w: number) {
    if (this._rootNode) {
      this._rootNode.style.left = `${x}px`;
      this._rootNode.style.top = `${y}px`;
      if (w) {
        this._rootNode.style.width = `${w}px`;
      }
    }
  }

  renderH(h: number) {
    // ignore h change, since it's handled by html layout
  }

  selectAndDrag = (e: DragState) => {
    let {item} = this.props;
    if (e.event.ctrlKey) {
      item.stage.selectBlock(item.path, true);
    } else {
      item.stage.selectBlock(item.path);
    }
    if (item.selected) {
      let draggingBlocks = item.stage.startDragBlock(e);
      if (draggingBlocks.length === 1 && item.w) {
        // when dragging 1 block that's not minimized, check if it can be dropped into block footer
        e.setData({moveBlock: item.path}, item.stage);
      }
      e.startDrag(null, null);
      item.stage.focus();
    }
  };

  selectAndNotDrag = (e: DragState) => {
    let {item} = this.props;
    if (e.event.ctrlKey) {
      item.stage.selectBlock(item.path, true);
    } else {
      item.stage.selectBlock(item.path);
    }
    if (item.selected) {
      item.stage.focus();
    }
  };

  onDragMove = (e: DragState) => {
    let {item} = this.props;
    if (item._syncParent && !item._syncParent.selected && e.moved()) {
      item.unLinkSyncParent();
    } else {
      let dropOnFoot = BlockView._footDropMap.get(e);
      if (dropOnFoot) {
        item.setXYW(dropOnFoot.x, dropOnFoot.y + dropOnFoot.h, dropOnFoot.w);
        return;
      }
    }
    if (!this.state.moving && e.moved()) {
      this.safeSetState({moving: true});
    }
    this.props.item.stage.onDragBlockMove(e);
  };
  onDragEnd = (e: DragState) => {
    this.props.item.stage.onDragBlockEnd(e);
    this.safeSetState({moving: false});
  };

  expandBlock = (e: React.MouseEvent) => {
    let {item} = this.props;
    if (item.w) {
      item.setXYW(item.x, item.y, 0);
    } else {
      item.setXYW(item.x, item.y, 150);
    }
  };

  _baseW: number = -1;

  startDragW = (e: DragState) => {
    let {item} = this.props;
    this._baseW = item.w;
    e.startDrag(null, null);
  };

  onDragWMove = (e: DragState) => {
    let {item} = this.props;
    let newW = Math.round(this._baseW + e.dx);
    if (!(newW > 80)) {
      newW = 80;
    }
    if (newW !== item.w) {
      while (item._syncParent) {
        // adjust the whole synced block chain
        item = item._syncParent;
      }
      item.setXYW(item.x, item.y, newW, true);
    }
  };

  onDragWEnd = (e: DragState) => {
    this._baseW = -1;
  };

  static _footDropMap: WeakMap<DragState, BlockItem> = new WeakMap<DragState, BlockItem>();
  onDragOverFoot = (e: DragState) => {
    let {item} = this.props;
    if (item._syncChild) {
      return;
    }
    let movingBlockKey: string = DragState.getData('moveBlock', item.stage);
    if (movingBlockKey && movingBlockKey !== item.path) {
      BlockView._footDropMap.set(e, item);
      e.accept('');
      this.safeSetState({footDropping: true});
    }
  };
  onDropFoot = (e: DragState) => {
    let {item} = this.props;
    let movingBlockKey: string = DragState.getData('moveBlock', item.stage);
    if (movingBlockKey && movingBlockKey !== item.path) {
      let block = item.stage.getBlock(movingBlockKey);
      if (block) {
        block.linkSyncParent(item);
      }
    }
  };
  onDragLeaveFoot = (e: DragState) => {
    this.safeSetState({footDropping: false});
  };

  displayName = new LazyUpdateSubscriber(this);
  widget = new LazyUpdateSubscriber(this);
  constructor(props: BlockViewProps) {
    super(props);
    this.state = {moving: false, footDropping: false};
    this.displayName.subscribe(props.item.conn, `${props.item.path}.@b-name`);
    this.widget.subscribe(props.item.conn, `${props.item.path}.@b-widget`);
  }

  renderImpl() {
    let {item} = this.props;
    let {moving, footDropping} = this.state;
    let FullView = item.desc.view;

    let classNames: string[] = [];
    if (item.selected) {
      classNames.push('ticl-block-selected');
    }
    if (item.synced) {
      classNames.push('ticl-block-synced');
    }
    if (item._syncChild || footDropping) {
      classNames.push('ticl-block-sync-parent');
    }
    if (moving) {
      classNames.push('ticl-block-moving');
    }
    let displayName = getDisplayName(item.name, this.displayName.value);

    if (FullView) {
      classNames.push('ticl-block-full-view');
      let width = item.w;
      let widthDrag = item._syncParent ? null : (
        <DragDropDiv
          className="ticl-width-drag"
          onDragStartT={this.startDragW}
          onDragMoveT={this.onDragWMove}
          onDragEndT={this.onDragWEnd}
        />
      );
      if (!(width > 80)) {
        width = 150;
      }
      return (
        <DragDropDiv
          className={classNames.join(' ')}
          directDragT={true}
          getRef={this.getRef}
          style={{top: item.y, left: item.x, width}}
          onDragStartT={this.selectAndDrag}
          onDragMoveT={this.onDragMove}
          onDragEndT={this.onDragEnd}
          onDragOverT={this.onDragOverFoot}
          onDropT={this.onDropFoot}
          onDragLeaveT={this.onDragLeaveFoot}
        >
          <FullView conn={item.conn} path={item.path} updateViewHeight={item.setViewH} />
          {widthDrag}
        </DragDropDiv>
      );
    } else if (item.w) {
      classNames.push('ticl-block');
      let [colorClass, icon] = getFuncStyleFromDesc(item.desc, item.conn);
      classNames.push(colorClass);

      let widget: React.ReactNode;
      let WidgetType = BlockWidget.get(this.widget.value);
      if (WidgetType) {
        widget = (
          <div className="ticl-block-view">
            <WidgetType conn={item.conn} path={item.path} updateViewHeight={item.setViewH} />
          </div>
        );
      } else {
        item.setViewH(0);
      }
      return (
        <div ref={this.getRef} className={classNames.join(' ')} style={{top: item.y, left: item.x, width: item.w}}>
          <BlockHeaderView
            item={item.getHeaderCallField()}
            shared={item.shared}
            onDoubleClick={this.expandBlock}
            onDragStartT={this.selectAndDrag}
            onDragMoveT={this.onDragMove}
            onDragEndT={this.onDragEnd}
            name={item.name}
            icon={icon}
            displayName={displayName}
          />
          {widget}
          <div className="ticl-block-body">{item.renderFields()}</div>
          <DragDropDiv
            className="ticl-block-foot"
            directDragT={true}
            onDragStartT={this.selectAndNotDrag}
            onDragOverT={this.onDragOverFoot}
            onDropT={this.onDropFoot}
            onDragLeaveT={this.onDragLeaveFoot}
          >
            <DragDropDiv
              className="ticl-width-drag"
              onDragStartT={this.startDragW}
              onDragMoveT={this.onDragWMove}
              onDragEndT={this.onDragWEnd}
            />
          </DragDropDiv>
        </div>
      );
    } else if (item.descLoaded) {
      classNames.push('ticl-block');
      classNames.push('ticl-block-min');
      let headClasses = 'ticl-block-head ticl-block-prbg';
      if (item.shared) {
        headClasses = `${headClasses} ticl-block-head-shared`;
      }
      let [colorClass, icon] = getFuncStyleFromDesc(item.desc, item.conn);
      classNames.push(colorClass);
      return (
        <div ref={this.getRef} className={classNames.join(' ')} style={{top: item.y, left: item.x}}>
          <div className="ticl-block-min-bound" />
          <Tooltip title={displayName} mouseEnterDelay={0}>
            <DragDropDiv
              className={headClasses}
              directDragT={true}
              onDoubleClick={this.expandBlock}
              onDragStartT={this.selectAndDrag}
              onDragMoveT={this.onDragMove}
              onDragEndT={this.onDragEnd}
            >
              <TIcon icon={icon} />
            </DragDropDiv>
          </Tooltip>
        </div>
      );
    } else {
      // data not ready, don't renderer
      return <div ref={this.getRef} />;
    }
  }
  componentWillUnmount() {
    this.displayName.unsubscribe();
    this.widget.unsubscribe();
    super.componentWillUnmount();
  }
}
