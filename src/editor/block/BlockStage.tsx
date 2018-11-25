import React from "react";
import {ClientConnection} from "../../common/connect/ClientConnection";
import {DataMap} from "../../common/util/Types";
import {BlockItem, FieldItem, Stage, BlockView} from "./Block";
import {WireItem, WireView} from "./Wire";
import {getCurrentDragOffset, getInitDragState} from "../../ui/util/DragHelper";
import {cssNumber} from "../../ui/util/Types";

interface Props {
  conn: ClientConnection;
  basePath: string;
  style?: React.CSSProperties;
}

interface State {

}

export default class BlockStage extends React.Component<Props, State> implements Stage {

  private _rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this._rootNode = node;
  };

  private _selectRectNode!: HTMLElement;
  private getSelectRectRef = (node: HTMLDivElement): void => {
    this._selectRectNode = node;
  };

  _blocks: Map<string, BlockItem> = new Map<string, BlockItem>();
  _wires: Map<string, WireItem> = new Map<string, WireItem>();
  _fields: Map<string, FieldItem> = new Map<string, FieldItem>();
  _fieldLinks: Map<string, Set<FieldItem>> = new Map<string, Set<FieldItem>>();

  selectBlock(key: string, ctrl: boolean = false) {
    if (this._blocks.has(key)) {
      let block = this._blocks.get(key);
      if (ctrl) {
        block.setSelected(!block.selected);
      } else {
        if (block.selected) {
          return;
        }
        for (let [blockKey, blockItem] of this._blocks) {
          if (key === blockKey) {
            blockItem.setSelected(true);
          } else {
            blockItem.setSelected(false);
          }
        }
      }
    }
  }

  _initDragState: [number, number, number, number];
  _draggingBlocks?: [BlockItem, number, number][];
  _dragingSelect?: [number, number];

  isDraggingBlock(): boolean {
    return Boolean(this._draggingBlocks);
  }

  // drag a block, return true when the dragging is started
  dragStart(event: React.MouseEvent) {
    this.endDrag();
    let e = event.nativeEvent;
    // cache the position of all dragging blocks
    this._initDragState = getInitDragState(e, this._rootNode);

    this._draggingBlocks = [];
    for (let [blockKey, blockItem] of this._blocks) {
      if (blockItem.selected) {
        this._draggingBlocks.push([blockItem, blockItem.x, blockItem.y]);
      }
    }
    document.body.addEventListener('mousemove', this.onDragBlockMove);
    document.body.addEventListener('mouseup', this.onDragBlockEnd);
  }

  onDragBlockMove = (e: MouseEvent) => {
    let [dx, dy] = getCurrentDragOffset(e, this._initDragState);
    for (let [block, x, y] of this._draggingBlocks) {
      block.setXYW(x + dx, y + dy, block.w);
      block.conn.setValue('@b-xyw', [block.x, block.y, block.w]);
    }
  };
  onDragBlockEnd = (e?: MouseEvent) => {
    this._draggingBlocks = null;
    document.body.removeEventListener('mousemove', this.onDragBlockMove);
    document.body.removeEventListener('mouseup', this.onDragBlockEnd);
  };

  onSelectRectDragStart = (event: React.MouseEvent) => {
    event.preventDefault();

    if (event.target !== this._rootNode) {
      // only allows background dragging
      return;
    }

    this.endDrag();
    let e = event.nativeEvent;
    this._initDragState = getInitDragState(e, this._rootNode);
    this._dragingSelect = [e.offsetX, e.offsetY];
    document.body.addEventListener('mousemove', this.onDragSelectMove);
    document.body.addEventListener('mouseup', this.onDragSelectDone);
    this._selectRectNode.style.display = 'block';
  };

  onDragSelectMove = (e: MouseEvent) => {
    let [dx, dy] = getCurrentDragOffset(e, this._initDragState);
    let [x1, y1] = this._dragingSelect;
    let x2 = dx + x1;
    let y2 = dy + y1;
    this._selectRectNode.style.left = `${cssNumber(Math.min(x1, x2))}px`;
    this._selectRectNode.style.width = `${cssNumber(Math.abs(x1 - x2))}px`;
    this._selectRectNode.style.top = `${cssNumber(Math.min(y1, y2))}px`;
    this._selectRectNode.style.height = `${cssNumber(Math.abs(y1 - y2))}px`;
  };
  onDragSelectDone = (e: MouseEvent) => {
    let [dx, dy] = getCurrentDragOffset(e, this._initDragState);
    let [x1, y1] = this._dragingSelect;
    let x2 = dx + x1;
    let y2 = dy + y1;
    let left = Math.min(x1, x2);
    let right = Math.max(x1, x2);
    let top = Math.min(y1, y2);
    let bottom = Math.max(y1, y2);
    let addToSelect = e.shiftKey || e.ctrlKey;
    for (let [blockKey, blockItem] of this._blocks) {
      if (blockItem.x >= left && blockItem.w + blockItem.x <= right
        && blockItem.y >= top && blockItem.h + blockItem.y <= bottom) {
        blockItem.setSelected(true);
      } else if (blockItem.selected && !addToSelect) {
        blockItem.setSelected(false);
      }
    }
    this.onDragSelectEnd();
  };

  onDragSelectEnd() {
    this._selectRectNode.style.display = null;
    this._selectRectNode.style.width = '0';
    this._dragingSelect = null;
    document.body.removeEventListener('mousemove', this.onDragSelectMove);
    document.body.removeEventListener('mouseup', this.onDragSelectDone);
  }


  endDrag() {
    if (this._draggingBlocks) {
      this.onDragBlockEnd();
    }
    if (this._dragingSelect) {
      this.onDragSelectEnd();
    }
  }

  linkField(souceKey: string, targetField: FieldItem) {
    if (!this._fieldLinks.has(souceKey)) {
      this._fieldLinks.set(souceKey, new Set<FieldItem>());
    }
    this._fieldLinks.get(souceKey).add(targetField);
    targetField.sourceChanged(this._fields.get(souceKey));
  }

  unlinkField(sourceKey: string, targetField: FieldItem) {
    let links = this._fieldLinks.get(sourceKey);
    if (links) {
      links.delete(targetField);
      if (links.size === 0) {
        this._fieldLinks.delete(sourceKey);
      }
    }
  }

  registerField(key: string, item: FieldItem) {
    this._fields.set(key, item);
    if (this._fieldLinks.has(key)) {
      for (let target of this._fieldLinks.get(key)) {
        target.sourceChanged(item);
      }
    }
  }

  unregisterField(key: string, item: FieldItem) {
    if (this._fields.get(key) === item) {
      this._fields.delete(key);
      if (this._fieldLinks.has(key)) {
        for (let target of this._fieldLinks.get(key)) {
          target.sourceChanged(null);
        }
      }
    }
  }

  watchListener = {
    onUpdate: (response: DataMap) => {
      let changes = response.changes;
      for (let name in changes) {
        let change = changes[name];
        if (change === null) {
          if (this._blocks.has(name)) {
            this._blocks.delete(name);
            this.forceUpdate();
          }
        } else {
          if (!this._blocks.has(name)) {
            this._blocks.set(`${this.props.basePath}.${name}`, new BlockItem(this.props.conn, this, `${this.props.basePath}.${name}`));
            this.forceUpdate();
          }
        }
      }
    }
  };

  constructor(props: Props) {
    super(props);
    props.conn.watch(props.basePath, this.watchListener);
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    if (nextProps.basePath !== this.props.basePath) {
      // TODO clear cached blocks
      this.props.conn.unwatch(this.props.basePath, this.watchListener);
      this.props.conn.watch(nextProps.basePath, this.watchListener);
    }
    return true;
  }

  render() {
    let {style} = this.props;

    let children: React.ReactNode[] = [];

    // add wires
    for (let [key, fieldItem] of this._fields) {
      if (fieldItem.inWire) {
        children.push(<WireView key={`~${key}`} item={fieldItem.inWire}/>);
      }
    }
    // add blocks
    for (let [key, blockItem] of this._blocks) {
      children.push(<BlockView key={key} item={blockItem}/>);
    }

    return (
      <div ref={this.getRef} style={style} className="ticl-block-stage"
           onMouseDown={this.onSelectRectDragStart}>
        {children}
        <div ref={this.getSelectRectRef} className="ticl-block-select-rect"/>
      </div>
    );
  }

  componentWillUnmount() {
    this.props.conn.unwatch(this.props.basePath, this.watchListener);
    this.endDrag();
  }
}
