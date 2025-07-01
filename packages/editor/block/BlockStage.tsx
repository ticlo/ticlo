import React, {ClipboardEventHandler, CSSProperties, KeyboardEvent} from 'react';
import {Button, notification, Modal} from 'antd';
import ZoomInIcon from '@ant-design/icons/ZoomInOutlined';
import ZoomOutIcon from '@ant-design/icons/ZoomOutOutlined';
import UndoIcon from '@ant-design/icons/UndoOutlined';
import RedoIcon from '@ant-design/icons/ReloadOutlined';

import {BlockView} from './Block';
import {WireView} from './Wire';
import {DragDropDiv, DragState, GestureState} from 'rc-dock';
import {cssNumber} from '../util/Types';
import {onDragBlockOver, onDropBlock} from './DragDropBlock';
import ResizeObserver from 'resize-observer-polyfill';
import {BlockStageBase, StagePropsBase} from './BlockStageBase';
import {MiniBlockView} from './MiniStage';
import debounce from 'lodash/debounce';
import clamp from 'lodash/clamp';
import {TooltipIconButton} from '../component/TooltipIconButton';
import {DataMap, decode, encode} from '@ticlo/core';
import {t} from '../component/LocalizedLabel';

const MINI_WINDOW_SIZE = 128;

interface StageState {
  zoom: number;
  contentWidth: number;
  contentHeight: number;
  stageWidth: number;
  stageHeight: number;
  modal?: React.ReactElement;
}

const zooms = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

function getNextZoom(v: number) {
  for (let z of zooms) {
    if (z > v) {
      return z;
    }
  }
  return 4;
}

function getPrevZoom(v: number) {
  let result = 0.25;
  for (let z of zooms) {
    if (!(z < v)) {
      break;
    }
    result = z;
  }
  return result;
}

interface BlockStageProps extends StagePropsBase {
  toolButtons?: React.ReactNode;
}

export class BlockStage extends BlockStageBase<BlockStageProps, StageState> {
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

  getRootElement() {
    return this._rootNode;
  }

  private _selectRectNode!: HTMLElement;
  private getSelectRectRef = (node: HTMLDivElement): void => {
    this._selectRectNode = node;
  };

  private _miniWindowNode!: HTMLElement;
  private getMiniWindowRef = (node: HTMLDivElement): void => {
    this._miniWindowNode = node;
  };

  constructor(props: StagePropsBase) {
    super(props);
    this.state = {
      zoom: 1,
      contentWidth: 0,
      contentHeight: 0,
      stageWidth: 0,
      stageHeight: 0,
    };
  }

  resizeObserver: ResizeObserver;

  componentDidMount() {
    super.componentDidMount();
    this._scrollNode.addEventListener('scroll', this.handleScroll, {
      passive: true,
    });

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this._rootNode);

    // TODO figure out why directly adding listener on this._rootNode doesn't work
    document.body.addEventListener('paste', this.onPaste);
  }

  _hasPopup = false;

  static findOpenPopups() {
    return (
      document.querySelector(
        'body>div:not([id])>div>div.ant-select-dropdown:not(.ant-select-dropdown-hidden):not(.slide-up-leave)'
      ) != null ||
      document.querySelector(
        'body>div:not([id])>div>div.ant-picker-dropdown:not(.ant-picker-dropdown-hidden):not(.slide-up-leave)'
      ) != null ||
      document.querySelector(
        'body>div:not([id])>div>div.ant-dropdown:not(.ant-dropdown-hidden):not(.slide-up-leave)'
      ) != null ||
      document.querySelector(
        'body>div:not([id])>div>div.ticl-dropdown:not(.ticl-dropdown-hidden):not(.slide-up-leave)'
      ) != null
    );
  }

  onSelectRectDragStart = (e: DragState) => {
    if (e.event.target === this._bgNode) {
      let rect = this._bgNode.getBoundingClientRect();
      this._dragingSelect = [(e.clientX - rect.left) * e.component.scaleX, (e.clientY - rect.top) * e.component.scaleY];
      e.startDrag(null, null);
      this._selectRectNode.style.display = 'block';
      this._hasPopup = BlockStage.findOpenPopups();
    }
  };

  onDragSelectMove = (e: DragState) => {
    let [x1, y1] = this._dragingSelect;
    let x2 = e.dx + x1;
    let y2 = e.dy + y1;
    this._selectRectNode.style.left = `${cssNumber(Math.min(x1, x2))}px`;
    this._selectRectNode.style.width = `${cssNumber(Math.abs(x1 - x2))}px`;
    this._selectRectNode.style.top = `${cssNumber(Math.min(y1, y2))}px`;
    this._selectRectNode.style.height = `${cssNumber(Math.abs(y1 - y2))}px`;
  };
  onDragSelectEnd = (e: DragState) => {
    // if e==null, then the dragging is canceled
    if (e && e.event) {
      // when single click blank area closed some popups, skip the de-selecting
      if (!(e.dx === 0 && e.dy === 0 && this._hasPopup && !BlockStage.findOpenPopups())) {
        let [x1, y1] = this._dragingSelect;
        let x2 = e.dx + x1;
        let y2 = e.dy + y1;
        let left = Math.min(x1, x2) - 1;
        let right = Math.max(x1, x2) + 1;
        let top = Math.min(y1, y2) - 1;
        let bottom = Math.max(y1, y2) + 1;
        let addToSelect = e.event.shiftKey || e.event.ctrlKey;
        for (let [blockKey, blockItem] of this._blocks) {
          if (
            blockItem.x >= left &&
            blockItem.w + blockItem.x <= right &&
            blockItem.y >= top &&
            blockItem.y + 24 <= bottom
          ) {
            blockItem.setSelected(true);
          } else if (blockItem.selected && !addToSelect) {
            blockItem.setSelected(false);
          }
        }

        if (e.dx === 0 && e.dy === 0) {
          this.onSelectBase();
        } else {
          this.onSelect();
        }
      }
      this.focus();
    }
    this._selectRectNode.style.display = null;
    this._selectRectNode.style.width = '0';
    this._dragingSelect = null;
  };
  onRightDragStart = (e: DragState) => {
    if (e.dragType === 'right') {
      this._dragScrollPos = [this._scrollX, this._scrollY];
      e.startDrag(null, null);
    }
  };
  onRightDragMove = (e: DragState) => {
    this.onDragMoveScroll(e, true);
  };
  onRightDragEnd = (e: DragState) => {
    this._dragScrollPos = null;
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
  _pendingScroll: [number, number];

  handleScroll = (event: UIEvent) => {
    if (this._scrollX !== this._scrollNode.scrollLeft || this._scrollY !== this._scrollNode.scrollTop) {
      this._scrollX = this._scrollNode.scrollLeft;
      this._scrollY = this._scrollNode.scrollTop;
      this.forceUpdate();
    }
  };

  componentDidUpdate(prevProps: Readonly<StagePropsBase>, prevState: Readonly<StageState>, snapshot?: any): void {
    if (this._pendingScroll) {
      this._scrollX = this._pendingScroll[0];
      if (this._scrollX > this._scrollNode.scrollWidth - this._scrollNode.clientWidth) {
        this._scrollX = this._scrollNode.scrollWidth - this._scrollNode.clientWidth;
      }
      this._scrollNode.scrollLeft = this._scrollX;

      this._scrollY = this._pendingScroll[1];
      if (this._scrollY > this._scrollNode.scrollHeight - this._scrollNode.clientHeight) {
        this._scrollY = this._scrollNode.scrollHeight - this._scrollNode.clientHeight;
      }
      this._scrollNode.scrollTop = this._scrollY;

      this._pendingScroll = null;
    }
  }

  _dragScrollPos?: [number, number];
  onZoomWindowDragStart = (e: DragState) => {
    this._dragScrollPos = [this._scrollX, this._scrollY];
    e.startDrag(null, null);
  };
  onDragMoveScroll = (e: {dx: number; dy: number}, reverseDrag = false) => {
    let {zoom, contentWidth, contentHeight, stageWidth, stageHeight} = this.state;
    let viewWidth = Math.max(contentWidth, Math.floor(stageWidth / zoom));
    let viewHeight = Math.max(contentHeight, Math.floor(stageHeight / zoom));
    let posRatio: number;
    if (!reverseDrag) {
      let miniScale = Math.min(MINI_WINDOW_SIZE / viewWidth, MINI_WINDOW_SIZE / viewHeight);
      posRatio = zoom / miniScale;
    } else {
      posRatio = -1;
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

    if (this._pendingScroll) {
      this._pendingScroll = [scrollX, scrollY];
    } else {
      this._scrollNode.scrollLeft = scrollX;
      this._scrollNode.scrollTop = scrollY;
    }
  };
  onZoomWindowDragEnd = (e: DragState) => {
    this._dragScrollPos = null;
  };

  _baseZoomBeforeGesture: number = -1;
  onGestureStart = (e: GestureState) => {
    this._dragScrollPos = [this._scrollX, this._scrollY];
    this._baseZoomBeforeGesture = -1;
    return true;
  };
  onGestureMove = (e: GestureState) => {
    let {zoom} = this.state;

    if (this._baseZoomBeforeGesture === -1 && (e.scale > 1.1 || e.scale < 0.9) && e.dx === 0 && e.dy === 0) {
      // avoid too much zoom during drag location
      this._baseZoomBeforeGesture = this.state.zoom;
    }

    if (this._baseZoomBeforeGesture > 0) {
      let newZoom = clamp(this._baseZoomBeforeGesture * e.scale, 0.25, 4);
      let {touches} = e.event;
      let event = {
        clientX: (touches[0].clientX + touches[1].clientX) / 2,
        clientY: (touches[0].clientY + touches[1].clientY) / 2,
      };

      if (newZoom !== zoom) {
        this.changeZoom(newZoom, event);
        this.onDragMoveScroll(e, true);
        this.safeSetState({zoom: newZoom});
        return;
      }
    }
    this.onDragMoveScroll(e, true);
  };

  getMiniStageStyle(): {
    miniStageStyle?: CSSProperties;
    minStageBgStyle?: CSSProperties;
    miniWindowStyle?: CSSProperties;
  } {
    let {zoom, contentWidth, contentHeight, stageWidth, stageHeight} = this.state;
    let viewWidth = Math.max(contentWidth, Math.floor(stageWidth / zoom));
    let viewHeight = Math.max(contentHeight, Math.floor(stageHeight / zoom));
    let miniScale = Math.min(MINI_WINDOW_SIZE / viewWidth, MINI_WINDOW_SIZE / viewHeight);
    let miniWidth = miniScale * viewWidth;
    let miniHeight = miniScale * viewHeight;

    let windowWidth = (stageWidth * miniScale) / zoom;
    let windowHeight = (stageHeight * miniScale) / zoom;
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
      left: (this._scrollX * miniScale) / zoom,
      top: (this._scrollY * miniScale) / zoom,
    };
    return {miniStageStyle, minStageBgStyle, miniWindowStyle};
  }

  onWheel = (e: WheelEvent) => {
    if (e.altKey) {
      if (e.deltaY < 0) {
        this.zoomIn(e);
      } else if (e.deltaY > 0) {
        this.zoomOut(e);
      }
      e.stopPropagation();
      e.preventDefault();
    }
  };
  zoomIn = (event: any) => {
    let {zoom} = this.state;
    if (!(event instanceof MouseEvent)) {
      event = null;
    }
    if (zoom < 4) {
      let newZoom = getNextZoom(zoom);
      this.changeZoom(newZoom, event);
      this.safeSetState({zoom: newZoom});
    }
  };
  zoomOut = (event: any) => {
    let {zoom} = this.state;
    if (!(event instanceof MouseEvent)) {
      event = null;
    }
    if (zoom > 0.25) {
      let newZoom = getPrevZoom(zoom);
      this.changeZoom(newZoom, event);
      this.safeSetState({zoom: newZoom});
    }
  };

  changeZoom(newZoom: number, event?: {clientX: number; clientY: number}) {
    let {zoom, stageWidth, stageHeight, contentWidth, contentHeight} = this.state;
    let offX = stageWidth / 2;
    let offY = stageWidth / 2;
    if (event) {
      let rect = this._scrollNode.getBoundingClientRect();
      offX = ((event.clientX - rect.left) * this._scrollNode.offsetWidth) / rect.width;
      offY = ((event.clientY - rect.top) * this._scrollNode.offsetHeight) / rect.height;
    }
    let centerX = (this._scrollX + offX) / zoom;
    let centerY = (this._scrollY + offY) / zoom;
    let pendingScrollX = centerX * newZoom - offX;
    let pendingScrollY = centerY * newZoom - offY;
    if (pendingScrollX < 0) {
      pendingScrollX = 0;
    }
    if (pendingScrollY < 0) {
      pendingScrollY = 0;
    }
    this._pendingScroll = [pendingScrollX, pendingScrollY];
    if (this._dragScrollPos) {
      this._dragScrollPos[0] += pendingScrollX - this._scrollX;
      this._dragScrollPos[1] += pendingScrollY - this._scrollY;
    }
  }

  onResize = () => {
    if (!(this._scrollNode.offsetWidth > 32 && this._scrollNode.offsetHeight > 32)) {
      // ignore resize event when size is too small
      // measure and layout is useless
      return;
    }
    this.safeSetState({
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
    this.safeSetState({
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

  undo = () => {
    let {conn, basePath} = this.props;
    conn.undo(basePath);
  };
  redo = () => {
    let {conn, basePath} = this.props;
    conn.redo(basePath);
  };

  renderImpl() {
    let {style, conn, basePath, toolButtons} = this.props;
    let {zoom, contentWidth, contentHeight, stageWidth, stageHeight, modal} = this.state;

    let children: React.ReactNode[] = [];
    let miniChildren: React.ReactNode[] = [];

    // add wires
    for (let [key, fieldItem] of this._fields) {
      if (fieldItem.inWire) {
        children.push(<WireView key={`~${key}`} item={fieldItem.inWire} />);
      }
    }
    // add blocks
    for (let [key, blockItem] of this._blocks) {
      children.push(<BlockView key={key} item={blockItem} />);
      miniChildren.push(<MiniBlockView key={key} item={blockItem} />);
    }

    let viewWidth = Math.max(contentWidth, Math.floor(stageWidth / zoom));
    let viewHeight = Math.max(contentHeight, Math.floor(stageHeight / zoom));

    // work around of how browser calculate scroll content size
    // since the size before scale and after scale are both counted, we need to get the smaller one
    let contentSizeZoom = zoom > 1 ? 1 : zoom;

    let contentLayerStyle = {
      transform: `scale(${zoom},${zoom})`,
      width: viewWidth * contentSizeZoom,
      height: viewHeight * contentSizeZoom,
    };
    let contentBgStyle = {
      width: viewWidth,
      height: viewHeight,
    };

    let {miniStageStyle, minStageBgStyle, miniWindowStyle} = this.getMiniStageStyle();

    let miniStage: React.ReactNode;
    if (miniWindowStyle) {
      miniStage = (
        <div className="ticl-mini-stage-bg" style={minStageBgStyle}>
          <div className="ticl-mini-stage" style={miniStageStyle}>
            {miniChildren}
          </div>
          <DragDropDiv
            getRef={this.getMiniWindowRef}
            className="ticl-mini-stage-window"
            style={miniWindowStyle}
            onDragStartT={this.onZoomWindowDragStart}
            onDragMoveT={this.onDragMoveScroll}
            onDragEndT={this.onZoomWindowDragEnd}
          />
        </div>
      );
    }

    return (
      <div style={style} className="ticl-stage" ref={this.getRootRef} onKeyDown={this.onKeyDown} tabIndex={0}>
        <DragDropDiv
          className="ticl-stage-scroll"
          getRef={this.getScrollLayerRef}
          onDragOverT={this.onDragOver}
          onDropT={this.onDrop}
        >
          <DragDropDiv
            className="ticl-stage-scroll-content"
            style={contentLayerStyle}
            onDragStartT={this.onRightDragStart}
            onDragMoveT={this.onRightDragMove}
            onDragEndT={this.onRightDragEnd}
            useRightButtonDragT={true}
            onGestureStartT={this.onGestureStart}
            onGestureMoveT={this.onGestureMove}
          >
            <DragDropDiv
              className="ticl-stage-bg"
              getRef={this.getBgRef}
              style={contentBgStyle}
              directDragT={true}
              onDragStartT={this.onSelectRectDragStart}
              onDragMoveT={this.onDragSelectMove}
              onDragEndT={this.onDragSelectEnd}
            />
            {children}
            <div ref={this.getSelectRectRef} className="ticl-block-select-rect" />
          </DragDropDiv>
        </DragDropDiv>
        <div className="ticl-stage-zoom">
          <div className="ticl-hbox">
            <Button className="ticl-icon-btn" shape="circle" icon={<ZoomOutIcon />} onClick={this.zoomOut} />
            <span className="ticl-stage-zoom-label">{Math.round(zoom * 100)}%</span>
            <Button className="ticl-icon-btn" shape="circle" icon={<ZoomInIcon />} onClick={this.zoomIn} />
          </div>
          {miniStage}
        </div>
        <div className="ticl-stage-toolbar">
          {toolButtons}
          <TooltipIconButton
            conn={conn}
            path={`${basePath}.@has-undo`}
            tooltip={t('Undo')}
            tooltipPlacement="left"
            icon={<UndoIcon />}
            onClick={this.undo}
          />
          <TooltipIconButton
            conn={conn}
            path={`${basePath}.@has-redo`}
            tooltip={t('Redo')}
            tooltipPlacement="left"
            icon={<RedoIcon />}
            onClick={this.redo}
          />
        </div>
        {modal}
      </div>
    );
  }

  onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Delete': {
        this.deleteSelectedBlocks();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      case 'c': {
        if (e.ctrlKey || e.metaKey) {
          this.onCopy();
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
    }
  };

  onCopy = async () => {
    try {
      let {conn, basePath} = this.props;
      let props: string[] = [];
      let basePathDot = `${basePath}.`;
      for (let [, blockItem] of this._blocks) {
        if (blockItem.selected && blockItem.path.startsWith(basePathDot)) {
          props.push(blockItem.path.substring(basePathDot.length));
        }
      }
      if (!props.length) {
        // nothing to copy
        return;
      }

      let data = await conn.copy(basePath, props);
      await window.navigator.clipboard.writeText(encode(data.value));
    } catch (e) {
      notification.error({message: 'Failed to copy', description: String(e)});
    }
  };
  onPaste = async (e: ClipboardEvent) => {
    if (this._rootNode && document.activeElement === this._rootNode) {
      let txt = e.clipboardData.getData('Text');
      try {
        let data = decode(txt);
        if (data && typeof data === 'object') {
          this.pasteData(data);
        } else {
          notification.error({message: 'Failed to paste', description: 'Invalid input'});
        }
      } catch (e) {
        notification.error({message: 'Failed to paste', description: String(e)});
      }
    }
  };
  async pasteData(data: DataMap, resolve?: 'overwrite' | 'rename') {
    let {conn, basePath} = this.props;
    if (!resolve) {
      let existing: string[] = [];
      // check if object already exist
      for (let key in data) {
        if (key === '#shared') {
          let shared = data['#shared'];
          if (shared && typeof shared === 'object') {
            for (let skey in shared) {
              if (this._blocks.has(`${basePath}.#shared.${skey}`)) {
                existing.push(`#shared.${skey}`);
              }
            }
          }
        } else if (this._blocks.has(`${basePath}.${key}`)) {
          existing.push(key);
        }
      }
      if (existing.length) {
        this.showPasteConflict(existing, data);
        return;
      }
    }
    try {
      let response = await conn.paste(basePath, data, resolve);
      if (Array.isArray(response.pasted) && response.pasted.length) {
        setTimeout(() => {
          // make sure this is not unmounted
          if (this._mounted) {
            let paths = new Set(response.pasted.map((s: string) => `${basePath}.${s}`));
            for (let [blockKey, blockItem] of this._blocks) {
              if (paths.has(blockKey)) {
                blockItem.setSelected(true);
              } else {
                blockItem.setSelected(false);
              }
            }
            this.onSelect();
            this.focus();
          }
        }, 1);
      }
    } catch (e) {
      notification.error({message: 'Failed to paste', description: String(e)});
    }
    this.closeModal();
  }
  showPasteConflict(blocks: string[], data: DataMap) {
    this.setState({
      modal: (
        <Modal
          open={true}
          title="Conflict"
          onCancel={this.closeModal}
          bodyStyle={{whiteSpace: 'pre'}}
          footer={[
            <Button key="cancel" onClick={this.closeModal}>
              Cancel
            </Button>,
            <Button
              key="rename"
              onClick={
                /* tslint:disable-next-line:jsx-no-lambda */
                () => this.pasteData(data, 'rename')
              }
            >
              Rename
            </Button>,
            <Button
              key="overwrite"
              onClick={
                /* tslint:disable-next-line:jsx-no-lambda */
                () => this.pasteData(data, 'overwrite')
              }
            >
              Overwrite
            </Button>,
          ]}
        >
          <p>Following blocks already exist:</p>
          <p>{blocks.join('\n')}</p>
        </Modal>
      ),
    });
  }

  closeModal = () => {
    this.setState({modal: null});
  };

  componentWillUnmount() {
    document.body.removeEventListener('paste', this.onPaste);

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
