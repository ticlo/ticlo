import React from 'react';
import {ClientConn} from '../../core/client';
import {DataMap} from '../../core/util/DataTypes';
import {DragState} from 'rc-dock';
import {BlockItem, FieldItem, Stage} from './Field';
import {forAllPathsBetween} from '../../core/util/Path';
import {LazyUpdateComponent} from '../../ui/component/LazyUpdateComponent';

export interface StageProps {
  conn: ClientConn;
  basePath: string;
  style?: React.CSSProperties;
  onSelect?: (keys: string[]) => void;
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

  _blocks: Map<string, BlockItem> = new Map<string, BlockItem>();
  _blockLinks: Map<string, Set<BlockItem>> = new Map<string, Set<BlockItem>>();
  _fields: Map<string, FieldItem> = new Map<string, FieldItem>();
  _fieldLinks: Map<string, Set<FieldItem>> = new Map<string, Set<FieldItem>>();

  onSelect() {
    let {onSelect} = this.props;
    if (onSelect) {
      let selectedKeys: string[] = [];
      for (let [blockKey, blockItem] of this._blocks) {
        if (blockItem.selected) {
          selectedKeys.push(blockItem.key);
        }
      }
      onSelect(selectedKeys);
    }
    this.selectionChanged = false;
  }

  selectionChanged = false;

  selectBlock(key: string, ctrl: boolean = false) {
    if (this._blocks.has(key)) {
      let block = this._blocks.get(key);
      if (ctrl) {
        block.setSelected(!block.selected);
        this.selectionChanged = true;
      } else {
        if (block.selected) {
          return;
        }
        for (let [blockKey, blockItem] of this._blocks) {
          if (key === blockKey) {
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
    for (let [blockKey, blockItem] of this._blocks) {
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

  getBlock(key: string): BlockItem {
    return this._blocks.get(key);
  }

  linkParentBlock(parentKey: string, childBlock: BlockItem) {
    if (typeof childBlock === 'string') {
      let block = this._blocks.get(childBlock);
      if (block) {
        this.linkParentBlock(parentKey, block);
      }
      return;
    }
    if (!this._blockLinks.has(parentKey)) {
      this._blockLinks.set(parentKey, new Set<BlockItem>());
    }
    this._blockLinks.get(parentKey).add(childBlock);
    if (this._blocks.has(parentKey)) {
      childBlock.syncParent = this._blocks.get(parentKey);
    }
  }

  unlinkParentBlock(parentKey: string, childBlock: BlockItem) {
    let links = this._blockLinks.get(parentKey);
    if (links) {
      links.delete(childBlock);
      if (links.size === 0) {
        this._fieldLinks.delete(parentKey);
      }
    }
  }

  linkField(souceKey: string, targetField: FieldItem) {
    if (!this._fieldLinks.has(souceKey)) {
      this._fieldLinks.set(souceKey, new Set<FieldItem>());
    }
    this._fieldLinks.get(souceKey).add(targetField);
    let sourceFound = forAllPathsBetween(souceKey, this.props.basePath, (path) => {
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
    } else {
      let preFixPath = `${key}.`;
      for (let [path, links] of this._fieldLinks) {
        // search for children path to have a indirect binding wire
        if (path.startsWith(preFixPath)) {
          for (let target of links) {
            target.sourceChanged(item, true);
          }
        }
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
      } else {
        let preFixPath = `${key}.`;
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

  watchListener = {
    onUpdate: (response: DataMap) => {
      let changes = response.changes;
      for (let name in changes) {
        let change = changes[name];
        let key = `${this.props.basePath}.${name}`;
        if (change === null) {
          if (this._blocks.has(key)) {
            if (this._blocks.get(key).selected) {
              this.selectionChanged = true;
            }
            this._blocks.delete(key);
            this.forceUpdate();
          }
        } else {
          if (!this._blocks.has(key)) {
            // create new block
            let newBlockItem = new BlockItem(this.props.conn, this, key);
            this._blocks.set(key, newBlockItem);
            // update block links
            if (this._blockLinks.has(key)) {
              for (let target of this._blockLinks.get(key)) {
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
  };

  constructor(props: StageProps) {
    super(props);
    props.conn.watch(props.basePath, this.watchListener);
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
      let newKey = `${basePath}.${newName}`;
      this.selectBlock(newKey, false);
      this.onSelect(); // update the property list
    } catch (e) {
      // TODO show warning?
    }
  };

  deleteSelectedBlocks() {
    let {conn} = this.props;
    for (let [blockKey, blockItem] of this._blocks) {
      if (blockItem.selected) {
        conn.setValue(blockKey, undefined);
      }
    }
  }

  focus() {
    this.getRootElement().focus({preventScroll: true});
  }

  componentWillUnmount() {
    this.props.conn.unwatch(this.props.basePath, this.watchListener);
  }
}
