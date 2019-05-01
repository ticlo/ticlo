import React, {CSSProperties, KeyboardEvent} from "react";
import {ClientConnection} from "../../core/connect/ClientConnection";
import {DataMap} from "../../core/util/Types";
import {BlockView} from "./Block";
import {WireItem, WireView} from "./Wire";
import {DragDropDiv, DragState} from "rc-dock";
import {cssNumber} from "../../ui/util/Types";
import {BlockItem, FieldItem, Stage} from "./Field";
import {forAllPathsBetween} from "../../core/util/Path";
import {onDragBlockOver, onDropBlock} from "./DragDropBlock";
import ResizeObserver from 'resize-observer-polyfill';
import {BlockStageBase, StageProps} from "./BlockStageBase";
import {Button} from "antd";
import {MiniBlockView, MiniStage} from "./MiniStage";
import debounce from "lodash/debounce";
import {preventDefault} from "../../core/util/Functions";

const MINI_WINDOW_SIZE = 128;

interface StageState {
  zoom: number;
  contentWidth: number;
  contentHeight: number;
  stageWidth: number;
  stageHeight: number;
}

const zoomScales = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

function getScale(zoom: number) {
  if (zoom >= 0 && zoom < zoomScales.length) {
    return zoomScales[zoom];
  }
  return 1;
}

export class BlockStage extends BlockStageBase<StageState> {

  private _rootNode!: HTMLElement;
  private getRootRef = (node: HTMLDivElement): void => {
    this._rootNode = node;
    if (node) {
      node.addEventListener('wheel', this.onWheel, {passive: false});
    }
  };

  private _scrollNode!: HTMLElement;
  private getScrollLayerRef = (node: HTMLDivElement): void => {
    this._scrollNode = node;
  };

  private _bgNode!: HTMLElement;
  private getBgRef = (node: HTMLDivElement): void => {
    this._bgNode = node;
  };

  getRefElement() {
    return this._bgNode;
  }

  private _selectRectNode!: HTMLElement;
  private getSelectRectRef = (node: HTMLDivElement): void => {
    this._selectRectNode = node;
  };

  private _miniWindowNode!: HTMLElement;
  private getMiniWindowRef = (node: HTMLDivElement): void => {
    this._miniWindowNode = node;
  };

  constructor(props: StageProps) {
    super(props);
    this.state = {
      zoom: zoomScales.indexOf(1),
      contentWidth: 0,
      contentHeight: 0,
      stageWidth: 0,
      stageHeight: 0
    };
  }

  resizeObserver: any;

  componentDidMount() {
    this._scrollNode.addEventListener('scroll', this.handleScroll, {
      passive: true,
    });

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this._rootNode);
  }

  onSelectRectDragStart = (e: DragState) => {
    if (e.dragType === 'right') {
      this._dragScrollPos = [this._scrollX, this._scrollY];
      e.startDrag(null, null);
    } else {
      let rect = this._bgNode.getBoundingClientRect();
      this._dragingSelect = [(e.clientX - rect.left) * e.component.scaleX, (e.clientY - rect.top) * e.component.scaleY];
      e.startDrag(null, null);
      this._selectRectNode.style.display = 'block';
    }
  };

  onDragSelectMove = (e: DragState) => {
    if (e.dragType === 'right') {
      this.onDragMoveScroll(e, true);
    } else {
      let [x1, y1] = this._dragingSelect;
      let x2 = e.dx + x1;
      let y2 = e.dy + y1;
      this._selectRectNode.style.left = `${cssNumber(Math.min(x1, x2))}px`;
      this._selectRectNode.style.width = `${cssNumber(Math.abs(x1 - x2))}px`;
      this._selectRectNode.style.top = `${cssNumber(Math.min(y1, y2))}px`;
      this._selectRectNode.style.height = `${cssNumber(Math.abs(y1 - y2))}px`;
    }
  };
  onDragSelectEnd = (e: DragState) => {
    if (e) {
      // if e==null, then the dragging is canceled
      let [x1, y1] = this._dragingSelect;
      let x2 = e.dx + x1;
      let y2 = e.dy + y1;
      let left = Math.min(x1, x2) - 1;
      let right = Math.max(x1, x2) + 1;
      let top = Math.min(y1, y2) - 1;
      let bottom = Math.max(y1, y2) + 1;
      let addToSelect = e.event.shiftKey || e.event.ctrlKey;
      for (let [blockKey, blockItem] of this._blocks) {
        if (blockItem.x >= left && blockItem.w + blockItem.x <= right
          && blockItem.y >= top && blockItem.y + 24 <= bottom) {
          blockItem.setSelected(true);
        } else if (blockItem.selected && !addToSelect) {
          blockItem.setSelected(false);
        }
      }
      this.onSelect();
    }
    this._dragScrollPos = null;
    this._selectRectNode.style.display = null;
    this._selectRectNode.style.width = '0';
    this._dragingSelect = null;
  };

  onDragOver = (e: DragState) => {
    let {conn} = this.props;
    onDragBlockOver(conn, e);
  };

  onDrop = (e: DragState) => {
    let {conn} = this.props;
    onDropBlock(conn, e, this.createBlock, this._bgNode);
  };

  handleResize = () => {
    if (this.onResizeDebounce) {
      this.onResizeDebounce();
    }
  };
  _scrollX = 0;
  _scrollY = 0;
  handleScroll = (event: UIEvent) => {
    this._scrollX = this._scrollNode.scrollLeft;
    this._scrollY = this._scrollNode.scrollTop;
    this.forceUpdate();
  };

  _dragScrollPos?: [number, number];
  onZoomWindowDragStart = (e: DragState) => {
    this._dragScrollPos = [this._scrollX, this._scrollY];
    e.startDrag(null, null);
  };
  onDragMoveScroll = (e: DragState, rightDrag = false) => {
    let {zoom, contentWidth, contentHeight, stageWidth, stageHeight} = this.state;
    let zoomScale = getScale(zoom);
    let viewWidth = Math.max(contentWidth, Math.floor(stageWidth / zoomScale));
    let viewHeight = Math.max(contentHeight, Math.floor(stageHeight / zoomScale));
    let posRatio = -1;
    if (!rightDrag) {
      let miniScale = Math.min(MINI_WINDOW_SIZE / viewWidth, MINI_WINDOW_SIZE / viewHeight);
      posRatio = zoomScale / miniScale;
    }
    let scrollX = Math.round(this._dragScrollPos[0] + e.dx * posRatio);
    let scrollY = Math.round(this._dragScrollPos[1] + e.dy * posRatio);
    if (scrollX < 0) {
      scrollX = 0;
    } else if (scrollX > this._scrollNode.scrollWidth - this._scrollNode.clientWidth) {
      scrollX = this._scrollNode.scrollWidth - this._scrollNode.clientWidth;
    }
    if (scrollY < 0) {
      scrollY = 0;
    } else if (scrollY > this._scrollNode.scrollHeight - this._scrollNode.clientHeight) {
      scrollY = this._scrollNode.scrollHeight - this._scrollNode.clientHeight;
    }
    this._scrollNode.scrollLeft = scrollX;
    this._scrollNode.scrollTop = scrollY;
  };
  onZoomWindowDragEnd = (e: DragState) => {
    this._dragScrollPos = null;
  };

  getMiniStageStyle(): {miniStageStyle?: CSSProperties, minStageBgStyle?: CSSProperties, miniWindowStyle?: CSSProperties} {
    let {zoom, contentWidth, contentHeight, stageWidth, stageHeight} = this.state;
    let zoomScale = getScale(zoom);
    let viewWidth = Math.max(contentWidth, Math.floor(stageWidth / zoomScale));
    let viewHeight = Math.max(contentHeight, Math.floor(stageHeight / zoomScale));
    let miniScale = Math.min(MINI_WINDOW_SIZE / viewWidth, MINI_WINDOW_SIZE / viewHeight);
    let miniWidth = miniScale * viewWidth;
    let miniHeight = miniScale * viewHeight;

    let windowWidth = stageWidth * miniScale / zoomScale;
    let windowHeight = stageHeight * miniScale / zoomScale;
    if (!windowWidth || !windowHeight || (windowWidth > miniWidth - 1 && windowHeight > miniHeight - 1)) {
      return {};
    }

    let miniStageStyle = {
      transform: `scale(${miniScale},${miniScale})`,
    };
    let minStageBgStyle = {
      width: Math.ceil(viewWidth * miniScale),
      height: Math.ceil(viewHeight * miniScale),
    };
    let miniWindowStyle = {
      width: windowWidth,
      height: windowHeight,
      left: this._scrollX * miniScale / zoomScale,
      top: this._scrollY * miniScale / zoomScale,
    };
    return {miniStageStyle, minStageBgStyle, miniWindowStyle};
  }

  onWheel = (e: WheelEvent) => {
    if (e.altKey) {
      if (e.deltaY < 0) {
        this.zoomIn();
      } else if (e.deltaY > 0) {
        this.zoomOut();
      }
      e.stopPropagation();
      e.preventDefault();
    }
  };
  zoomIn = () => {
    let {zoom} = this.state;
    if (zoom < zoomScales.length - 1) {
      this.setState({zoom: zoom + 1});
    }
  };
  zoomOut = () => {
    let {zoom} = this.state;
    if (zoom > 0) {
      this.setState({zoom: zoom - 1});
    }
  };

  onResize = () => {
    this.setState({
      stageWidth: this._scrollNode.offsetWidth - 11,
      stageHeight: this._scrollNode.offsetHeight - 11,
    });
  };
  onResizeDebounce = debounce(this.onResize, 500);

  measureChildren = () => {
    let width = 0;
    let height = 0;
    // add blocks
    for (let [key, blockItem] of this._blocks) {
      // TODO check width height other time
      if (blockItem.w + blockItem.x > width) {
        width = blockItem.w + blockItem.x;
      }
      if (blockItem.h + blockItem.y > height) {
        height = blockItem.h + blockItem.y;
      }
    }
    this.setState({
      contentWidth: width + 32,
      contentHeight: height + 32,
    });
  };
  measureChildrenDebounce = debounce(this.measureChildren, 40);

  onChildrenSizeChanged() {
    if (this.measureChildrenDebounce && !this._draggingBlocks) {
      this.measureChildrenDebounce();
    }
  }

  render() {
    let {style} = this.props;
    let {zoom, contentWidth, contentHeight, stageWidth, stageHeight} = this.state;
    let zoomScale = getScale(zoom);

    let children: React.ReactNode[] = [];
    let miniChildren: React.ReactNode[] = [];

    // add wires
    for (let [key, fieldItem] of this._fields) {
      if (fieldItem.inWire) {
        children.push(<WireView key={`~${key}`} item={fieldItem.inWire}/>);
      }
    }
    // add blocks
    for (let [key, blockItem] of this._blocks) {
      children.push(<BlockView key={key} item={blockItem}/>);
      miniChildren.push(<MiniBlockView key={key} item={blockItem}/>);
    }

    let viewWidth = Math.max(contentWidth, Math.floor(stageWidth / zoomScale));
    let viewHeight = Math.max(contentHeight, Math.floor(stageHeight / zoomScale));
    let contentLayerStyle = {
      transform: `scale(${zoomScale},${zoomScale})`,
      width: viewWidth * zoomScale,
      height: viewHeight * zoomScale,
    };
    let contentBgStyle = {
      width: viewWidth,
      height: viewHeight,
    };

    let {miniStageStyle, minStageBgStyle, miniWindowStyle} = this.getMiniStageStyle();

    let miniStage: React.ReactNode;
    if (miniWindowStyle) {
      miniStage = (
        <div className='ticl-mini-stage-bg' style={minStageBgStyle}>
          <div className='ticl-mini-stage' style={miniStageStyle}>
            {miniChildren}
          </div>
          <DragDropDiv getRef={this.getMiniWindowRef} className='ticl-mini-stage-window' style={miniWindowStyle}
                       onDragStartT={this.onZoomWindowDragStart} onDragMoveT={this.onDragMoveScroll}
                       onDragEndT={this.onZoomWindowDragEnd}/>
        </div>
      );
    }

    return (
      <div style={style} className="ticl-stage ticl-scroll" ref={this.getRootRef} onKeyDown={this.onKeyDown}
           tabIndex={0}>
        <DragDropDiv className="ticl-stage-scroll" getRef={this.getScrollLayerRef} onDragOverT={this.onDragOver}
                     onDropT={this.onDrop}>
          <div className='ticl-stage-scroll-content' style={contentLayerStyle}>
            <DragDropDiv className='ticl-stage-bg' getRef={this.getBgRef} style={contentBgStyle} directDragT={true}
                         onDragStartT={this.onSelectRectDragStart} onDragMoveT={this.onDragSelectMove}
                         onDragEndT={this.onDragSelectEnd} onContextMenu={preventDefault}/>
            {children}
            <div ref={this.getSelectRectRef} className="ticl-block-select-rect"/>
          </div>
        </DragDropDiv>
        <div className='ticl-stage-zoom'>
          <div className='ticl-hbox'>
            <Button className='ticl-icon-btn' shape='circle' icon="zoom-out" onClick={this.zoomOut}/>
            <span className='ticl-stage-zoom-label'>{Math.round(zoomScale * 100)}%</span>
            <Button className='ticl-icon-btn' shape='circle' icon="zoom-in" onClick={this.zoomIn}/>
          </div>
          {miniStage}
        </div>
      </div>
    );
  }

  onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Delete': {
        this.deleteSelectedBlocks();
        return;
      }
    }
  };

  componentWillUnmount() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    this.onResizeDebounce.cancel();
    this.onResizeDebounce = null;

    this.measureChildrenDebounce.cancel();
    this.measureChildrenDebounce = null;

    super.componentWillUnmount();
  }

}
