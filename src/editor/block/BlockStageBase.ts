import React from 'react';
import {
  ClientConn,
  DataMap,
  deepEqual,
  forAllPathsBetween,
  ValueSubscriber,
  ValueUpdate
} from '../../../src/core/editor';
import {DragState} from 'rc-dock';
import {BlockItem, FieldItem, Stage} from './Field';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent';

export interface StageProps {
  conn: ClientConn;
  basePath: string;
  style?: React.CSSProperties;
  onSelect?: (paths: string[]) => void;
}

export abstract class BlockStageBase<State> extends LazyUpdateComponent<StageProps, State> implements Stage {
  abstract getRefElement(): HTMLElement;

  abstract getRootElement(): HTMLElement;

  abstract onChildrenSizeChanged(): void;

  // automatic block location
  nextXYx = 0;
  nextXYy = 0;

  /**
   * 0 1 4
   * 2 3 5
   * 6 7 8
   */
  getNextXYW() {
    let result: [number, number, number] = [this.nextXYx * 200 + 32, this.nextXYy * 200 + 32, 150];
    if (this.nextXYx === this.nextXYy) {
      this.nextXYx = this.nextXYy + 1;
      this.nextXYy = 0;
    } else if (this.nextXYy > this.nextXYx) {
      this.nextXYx++;
    } else {
      this.nextXYy++;
      if (this.nextXYx === this.nextXYy) {
        this.nextXYx = 0;
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
    let {onSelect} = this.props;
    if (onSelect) {
      let selectedPaths: string[] = [];
      for (let [, blockItem] of this._blocks) {
        if (blockItem.selected) {
          selectedPaths.push(blockItem.path);
        }
      }
      onSelect(selectedPaths);
    }
    this.selectionChanged = false;
  }

  selectionChanged = false;

  selectBlock(path: string, ctrl: boolean = false) {
    if (this._blocks.has(path)) {
      let block = this._blocks.get(path);
      if (ctrl) {
        block.setSelected(!block.selected);
        this.selectionChanged = true;
      } else {
        if (block.selected) {
          return;
        }
        for (let [blockPath, blockItem] of this._blocks) {
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
  startDragBlock(e: DragState) {
    this._draggingBlocks = [];
    for (let [, blockItem] of this._blocks) {
      if (blockItem.selected) {
        this._draggingBlocks.push([blockItem, blockItem.x, blockItem.y, blockItem.w]);
      }
    }
    return this._draggingBlocks;
  }

  onDragBlockMove(e: DragState) {
    let {conn} = this.props;
    conn.lockImmediate(e);
    for (let [block, x, y, w] of this._draggingBlocks) {
      if (!block._syncParent) {
        block.setXYW(x + e.dx, y + e.dy, w, true);
      }
    }
    conn.unlockImmediate(e);
  }

  onDragBlockEnd(e: DragState) {
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
      let block = this._blocks.get(childBlock);
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
    let links = this._blockLinks.get(parentPath);
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
    let sourceFound = forAllPathsBetween(sourcePath, this.props.basePath, (path) => {
      let field = this._fields.get(path);
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
    let links = this._fieldLinks.get(sourcePath);
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
      for (let target of this._fieldLinks.get(path)) {
        target.sourceChanged(item);
      }
    }
    let preFixPath = `${path}.`;
    for (let [path, links] of this._fieldLinks) {
      // search for children path to have a indirect binding wire
      if (path.startsWith(preFixPath)) {
        for (let target of links) {
          target.sourceChanged(item, true);
        }
      }
    }
  }

  unregisterField(path: string, item: FieldItem) {
    if (this._fields.get(path) === item) {
      this._fields.delete(path);
      if (this._fieldLinks.has(path)) {
        for (let target of this._fieldLinks.get(path)) {
          target.sourceChanged(null);
        }
      } else {
        let preFixPath = `${path}.`;
        for (let [path, links] of this._fieldLinks) {
          // search for children path to remove indirect binding wire
          if (path.startsWith(preFixPath)) {
            for (let target of links) {
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
    for (let name in changes) {
      let change = changes[name];
      let path = `${basePath}.${name}`;
      if (change === null) {
        if (this._blocks.has(path)) {
          if (this._blocks.get(path).selected) {
            this.selectionChanged = true;
          }
          this._blocks.delete(path);
          this.forceUpdate();
        }
      } else {
        if (!this._blocks.has(path)) {
          // create new block
          let newBlockItem = new BlockItem(this.props.conn, this, path, basePath === this._sharedPath);
          this._blocks.set(path, newBlockItem);
          // update block links
          if (this._blockLinks.has(path)) {
            for (let target of this._blockLinks.get(path)) {
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
      this.onChildUpdate(response.changes, this.props.basePath);
    }
  };
  sharedWatchListener = {
    onUpdate: (response: DataMap) => {
      this.onChildUpdate(response.changes, this._sharedPath);
    }
  };
  clearSharedBlocks() {}

  sharedListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      if (String(response.cache.value).startsWith('SharedBlock ')) {
        let {conn} = this.props;
        conn.watch(this._sharedPath, this.sharedWatchListener);
      } else {
        this.clearSharedBlocks();
      }
    }
  });

  constructor(props: StageProps) {
    super(props);
    let {conn, basePath} = props;
    this._sharedPath = `${basePath}.#shared`;
    conn.watch(basePath, this.watchListener);
    this.sharedListener.subscribe(conn, this._sharedPath);
  }

  UNSAFE_componentWillReceiveProps(nextProps: StageProps) {
    if (nextProps.basePath !== this.props.basePath) {
      // TODO clear cached blocks
      this.props.conn.unwatch(this.props.basePath, this.watchListener);
      this.props.conn.watch(nextProps.basePath, this.watchListener);
    }
  }

  createBlock = async (name: string, blockData: {[key: string]: any}) => {
    let {conn, basePath} = this.props;
    try {
      let newName = (await conn.createBlock(`${basePath}.${name}`, blockData, true)).name;
      let newPath = `${basePath}.${newName}`;
      this.selectBlock(newPath, false);
      this.onSelect(); // update the property list
    } catch (e) {
      // TODO show warning?
    }
  };

  deleteSelectedBlocks() {
    let {conn, basePath} = this.props;
    for (let [blockPath, blockItem] of this._blocks) {
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
    let {conn, basePath} = this.props;
    this.sharedListener.unsubscribe();
    conn.unwatch(basePath, this.watchListener);
    conn.unwatch(this._sharedPath, this.sharedWatchListener);
    super.componentWillUnmount();
  }
}
