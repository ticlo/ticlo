import React from 'react';
import {ClientConn, DataMap, deepEqual, forAllPathsBetween, ValueSubscriber, ValueUpdate} from '@ticlo/core/editor.js';
import {DragState} from 'rc-dock';
import {BlockItem, FieldItem, Stage} from './Field.js';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent.js';

export interface StagePropsBase {
  conn: ClientConn;
  basePath: string;
  style?: React.CSSProperties;
  onSelect?: (paths: string[]) => void;
}

function snapXY(x: number, y: number): [number, number] {
  const xi = Math.round(x);
  const yi = Math.round(y);
  const xm = xi % 24;
  const ym = yi % 24;
  const dx = Math.abs(xm - 12);
  const dy = Math.abs(ym - 12);
  if (dx + dy + Math.max(dx, dy) < 10) {
    return [xi - xm + 12, yi - ym + 12];
  }
  if (dy < 3) {
    return [xi, yi - ym + 12];
  }
  return [xi, yi];
}

export abstract class BlockStageBase<Props extends StagePropsBase, State>
  extends LazyUpdateComponent<Props, State>
  implements Stage
{
  abstract getRefElement(): HTMLElement;

  abstract getRootElement(): HTMLElement;

  abstract onChildrenSizeChanged(): void;

  // automatic block location
  nextBlockX = 0;
  nextBlockY = 0;

  /** order of new block's auto position
   * 0 1 4 9
   * 2 3 5 A
   * 6 7 8 B
   * C D E F
   */
  getNextXYW() {
    const result: [number, number, number] = [this.nextBlockX * 192 + 36, this.nextBlockY * 192 + 36, 143];
    if (this.nextBlockX === this.nextBlockY) {
      this.nextBlockX = this.nextBlockY + 1;
      this.nextBlockY = 0;
    } else if (this.nextBlockY > this.nextBlockX) {
      this.nextBlockX++;
    } else {
      this.nextBlockY++;
      if (this.nextBlockX === this.nextBlockY) {
        this.nextBlockX = 0;
      }
    }
    return result;
  }

  _sharedPath: string;

  _blocks: Map<string, BlockItem> = new Map<string, BlockItem>();
  _blockLinks: Map<string, Set<BlockItem>> = new Map<string, Set<BlockItem>>();
  _fields: Map<string, FieldItem> = new Map<string, FieldItem>();
  _fieldLinks: Map<string, Set<FieldItem>> = new Map<string, Set<FieldItem>>();

  onSelect() {
    const {onSelect} = this.props;
    if (onSelect) {
      const selectedPaths: string[] = [];
      for (const [, blockItem] of this._blocks) {
        if (blockItem.selected) {
          selectedPaths.push(blockItem.path);
        }
      }
      onSelect(selectedPaths);
    }
    this.selectionChanged = false;
  }
  onSelectBase() {
    const {onSelect, basePath} = this.props;
    if (onSelect) {
      onSelect([basePath]);
    }
    this.selectionChanged = false;
  }

  selectionChanged = false;

  selectBlock(path: string, ctrl: boolean = false) {
    if (this._blocks.has(path)) {
      const block = this._blocks.get(path);
      if (ctrl) {
        block.setSelected(!block.selected);
        this.selectionChanged = true;
      } else {
        if (block.selected) {
          return;
        }
        for (const [blockPath, blockItem] of this._blocks) {
          if (path === blockPath) {
            if (!blockItem.selected) {
              blockItem.setSelected(true);
              this.selectionChanged = true;
            }
          } else if (blockItem.selected) {
            blockItem.setSelected(false);
            this.selectionChanged = true;
          }
        }
      }
      if (!block.selected && this.selectionChanged) {
        // current block is not selected, dragging wont start
        // update the onSelect event now
        this.onSelect();
      }
    }
  }

  _draggingBlocks?: [BlockItem, number, number, number][];
  _dragingSelect?: [number, number];

  isDraggingBlock(): boolean {
    return Boolean(this._draggingBlocks);
  }

  // drag a block, return true when the dragging is started
  startDragBlock(e: DragState, item: BlockItem) {
    // first item is the one being dragged
    this._draggingBlocks = [[item, item.x, item.y, item.w]];

    for (const [, blockItem] of this._blocks) {
      if (blockItem.selected && blockItem !== item) {
        this._draggingBlocks.push([blockItem, blockItem.x, blockItem.y, blockItem.w]);
      }
    }
    return this._draggingBlocks;
  }

  onDragBlockMove(e: DragState) {
    const {conn} = this.props;
    if (this._draggingBlocks?.length) {
      conn.lockImmediate(e);
      const [firstItem, firstX, firstY] = this._draggingBlocks[0];
      const [ax, ay] = snapXY(firstX + e.dx, firstY + e.dy);
      const dx = ax - firstX;
      const dy = ay - firstY;
      for (const [blockItem, x, y, w] of this._draggingBlocks) {
        if (!blockItem._syncParent) {
          blockItem.setXYW(x + dx, y + dy, w, true);
        }
      }
      conn.unlockImmediate(e);
    }
  }

  onDragBlockEnd(e: DragState) {
    if (e.event == null || e.dropped === 'field') {
      // revert to previous position if drag is cancelled or a binding is created
      for (const [blockItem, x, y, w] of this._draggingBlocks) {
        blockItem.setXYW(x, y, w, true);
      }
    }
    this._draggingBlocks = null;
    if (this.selectionChanged) {
      // call the onSelect callback only when mouse up
      this.selectionChanged = false;
      this.onSelect();
    }
    this.onChildrenSizeChanged();
  }

  getBlock(path: string): BlockItem {
    return this._blocks.get(path);
  }

  linkParentBlock(parentPath: string, childBlock: BlockItem) {
    if (typeof childBlock === 'string') {
      const block = this._blocks.get(childBlock);
      if (block) {
        this.linkParentBlock(parentPath, block);
      }
      return;
    }
    if (!this._blockLinks.has(parentPath)) {
      this._blockLinks.set(parentPath, new Set<BlockItem>());
    }
    this._blockLinks.get(parentPath).add(childBlock);
    if (this._blocks.has(parentPath)) {
      childBlock.syncParent = this._blocks.get(parentPath);
    }
  }

  unlinkParentBlock(parentPath: string, childBlock: BlockItem) {
    const links = this._blockLinks.get(parentPath);
    if (links) {
      links.delete(childBlock);
      if (links.size === 0) {
        this._fieldLinks.delete(parentPath);
      }
    }
  }

  linkField(sourcePath: string, targetField: FieldItem) {
    if (!this._fieldLinks.has(sourcePath)) {
      this._fieldLinks.set(sourcePath, new Set<FieldItem>());
    }
    this._fieldLinks.get(sourcePath).add(targetField);
    const sourceFound = forAllPathsBetween(sourcePath, this.props.basePath, (path) => {
      const field = this._fields.get(path);
      if (field) {
        targetField.sourceChanged(field);
        return true;
      }
    });
    if (!sourceFound) {
      targetField.sourceChanged(null);
    }
  }

  unlinkField(sourcePath: string, targetField: FieldItem) {
    const links = this._fieldLinks.get(sourcePath);
    if (links) {
      links.delete(targetField);
      if (links.size === 0) {
        this._fieldLinks.delete(sourcePath);
      }
    }
  }

  registerField(path: string, item: FieldItem) {
    this._fields.set(path, item);
    if (this._fieldLinks.has(path)) {
      for (const target of this._fieldLinks.get(path)) {
        target.sourceChanged(item);
      }
    }
    const preFixPath = `${path}.`;
    for (const [path, links] of this._fieldLinks) {
      // search for children path to have a indirect binding wire
      if (path.startsWith(preFixPath)) {
        for (const target of links) {
          target.sourceChanged(item, true);
        }
      }
    }
  }

  unregisterField(path: string, item: FieldItem) {
    if (this._fields.get(path) === item) {
      this._fields.delete(path);
      if (this._fieldLinks.has(path)) {
        for (const target of this._fieldLinks.get(path)) {
          target.sourceChanged(null);
        }
      } else {
        const preFixPath = `${path}.`;
        for (const [path, links] of this._fieldLinks) {
          // search for children path to remove indirect binding wire
          if (path.startsWith(preFixPath)) {
            for (const target of links) {
              if (target.inWire.source === item) {
                target.sourceChanged(null);
              }
            }
          }
        }
      }
    }
  }

  onChildUpdate(changes: DataMap, basePath: string) {
    for (const name in changes) {
      const change = changes[name];
      const path = `${basePath}.${name}`;
      if (change === null) {
        const block = this._blocks.get(path);
        if (block) {
          if (block.selected) {
            this.selectionChanged = true;
          }
          // block.destroy(); // no need for destroy, already handled in block.onDetached();
          this._blocks.delete(path);
          this.forceUpdate();
        }
      } else {
        if (!this._blocks.has(path)) {
          // create new block
          const newBlockItem = new BlockItem(this.props.conn, this, path, basePath === this._sharedPath);
          this._blocks.set(path, newBlockItem);
          // update block links
          if (this._blockLinks.has(path)) {
            for (const target of this._blockLinks.get(path)) {
              target.syncParent = newBlockItem;
            }
          }
          this.forceUpdate();
        }
      }
    }
    if (this.selectionChanged) {
      this.onSelect();
    }
  }
  watchListener = {
    onUpdate: (response: DataMap) => {
      this.onChildUpdate(response.changes as DataMap, this.props.basePath);
    },
  };
  sharedWatchListener = {
    onUpdate: (response: DataMap) => {
      this.onChildUpdate(response.changes as DataMap, this._sharedPath);
    },
  };
  clearSharedBlocks() {
    let changed = false;
    for (const [key, block] of this._blocks) {
      if (block.shared) {
        changed = true;
        if (block.selected) {
          this.selectionChanged = true;
        }
        // block.destroy(); // no need for destroy, already handled in block.onDetached();
        this._blocks.delete(block.path);
      }
    }
    if (changed) {
      this.forceUpdate();
      if (this.selectionChanged) {
        this.onSelect();
      }
    }
  }

  sharedListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      if (Object.hasOwn(response.change, 'value')) {
        if (String(response.cache.value).startsWith('SharedBlock ')) {
          const {conn} = this.props;
          conn.watch(this._sharedPath, this.sharedWatchListener);
        } else {
          this.clearSharedBlocks();
        }
      }
    },
  });

  protected constructor(props: Props) {
    super(props);
    const {basePath} = props;
    this._sharedPath = `${basePath}.#shared`;
    this.watchingPath = basePath;
  }

  componentDidMount() {
    super.componentDidMount();
    const {conn} = this.props;
    conn.watch(this.watchingPath, this.watchListener);
    this.sharedListener.subscribe(conn, this._sharedPath);
  }

  watchingPath: string;
  render() {
    const {basePath} = this.props;
    if (this.watchingPath !== basePath) {
      // TODO clear cached blocks
      this.props.conn.unwatch(this.watchingPath, this.watchListener);
      this.watchingPath = basePath;
      this.props.conn.watch(basePath, this.watchListener);
    }
    return super.render();
  }

  createBlock = async (name: string, blockData: {[key: string]: any}, shared: boolean) => {
    const {conn, basePath} = this.props;
    const parentPath = shared ? this._sharedPath : basePath;
    try {
      const newName = (await conn.addBlock(`${parentPath}.${name}`, blockData, true)).name;
      const newPath = `${parentPath}.${newName}`;
      this.selectBlock(newPath, false);
      this.onSelect(); // update the property list
    } catch (e) {
      // TODO show warning?
    }
  };

  deleteSelectedBlocks() {
    const {conn, basePath} = this.props;
    for (const [blockPath, blockItem] of this._blocks) {
      if (blockItem.selected) {
        conn.setValue(blockPath, undefined);
      }
    }
    conn.childrenChangeStream().dispatch({path: basePath});
  }

  focus() {
    this.getRootElement().focus({preventScroll: true});
  }

  componentWillUnmount() {
    const {conn, basePath} = this.props;
    this.sharedListener.unsubscribe();
    conn.unwatch(basePath, this.watchListener);
    conn.unwatch(this._sharedPath, this.sharedWatchListener);
    super.componentWillUnmount();
  }
}
