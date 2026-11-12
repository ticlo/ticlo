import React from 'react';
import {Button} from 'antd';

import {ExpandIcon, TreeItem} from '../component/Tree.tsx';
import {PureDataRenderer} from '../component/DataRenderer.ts';
import {DragDropDiv, DragState} from 'rc-dock';
import {
  TRUNCATED,
  encodeDisplay,
  getTruncatedArrayLength,
  isDataTruncated,
  translateEditor,
} from '@ticlo/core/editor.ts';
import {snapshotTransportValue} from '@ticlo/core/util/TransportValue.ts';
import {displayNumber} from '../util/Types.tsx';
import {t} from '../component/LocalizedLabel.tsx';

const pageSize = 1000;

// Inspect only the bounded preview, stopping at large arrays without visiting their rows.
function containsLargeArray(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    const length = getTruncatedArrayLength(value);
    if ((length ?? value.length) >= pageSize) return true;
    const end = length === undefined ? value.length : value.length - 2;
    for (let index = 0; index < end; ++index) if (containsLargeArray(value[index])) return true;
  } else if (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) {
    for (const key of Object.keys(value)) {
      if (key !== TRUNCATED && containsLargeArray(value[key])) return true;
    }
  }
  return false;
}

export class ObjectTreeItem extends TreeItem<ObjectTreeItem> {
  childPrefix: string;
  name: string;
  data: any;
  rootPath: string;
  select: (string | number)[];
  total?: number;
  loading = false;
  error?: string;
  more = false;
  private offset = 0;
  private anchor: unknown;
  generation = 0;
  private disposed = false;

  constructor(rootPath: string, name: string, data: any, parent?: ObjectTreeItem) {
    super(parent);
    this.rootPath = rootPath;
    this.data = data;
    this.select = parent ? [...parent.select, Array.isArray(parent.data) ? Number(name) : name] : [];
    if (parent) {
      this.key = `${parent.childPrefix}${name}`;
      this.childPrefix = `${this.key}.`;
      this.name = name;
    } else {
      // root element;
      this.key = '';
      this.childPrefix = '';
      this.name = '';
      this.level = -1;
    }
    if (!isDataTruncated(data) && (!data || (data.constructor !== Object && !Array.isArray(data)))) {
      this.opened = 'empty';
    }
  }

  open() {
    this.opened = 'opened';
    if (!this.children) {
      if (this.rootPath && this.connection && (getTruncatedArrayLength(this.data) ?? 0) >= pageSize) {
        this.total = getTruncatedArrayLength(this.data);
        this.children = [];
        void this.loadMore();
      } else if (this.rootPath && this.connection && isDataTruncated(this.data) && !containsLargeArray(this.data)) {
        void this.loadValue();
      } else {
        this.createChildren();
      }
    }
    this.changed();
  }

  close() {
    this.opened = 'closed';
    this.changed();
  }

  createChildren() {
    const children: ObjectTreeItem[] = [];
    const length = getTruncatedArrayLength(this.data);
    if (Array.isArray(this.data)) {
      const end = length === undefined ? this.data.length : this.data.length - 2;
      for (let index = 0; index < end; ++index)
        children.push(new ObjectTreeItem(this.rootPath, String(index), this.data[index], this));
    } else if (this.data && typeof this.data === 'object') {
      for (const key of Object.keys(this.data)) {
        if (key !== TRUNCATED) children.push(new ObjectTreeItem(this.rootPath, key, this.data[key], this));
      }
    }
    this.children = children;
  }

  private changed() {
    this.onListChange?.();
    this.forceUpdate();
    if (this.children?.at(-1)?.more) this.children.at(-1).forceUpdate();
  }

  private addMore() {
    if (this.children?.at(-1)?.more) return;
    const more = new ObjectTreeItem(this.rootPath, TRUNCATED, undefined, this);
    more.more = true;
    (this.children ??= []).push(more);
  }

  private async loadValue() {
    this.loading = true;
    this.addMore();
    const generation = this.generation;
    try {
      const result = await this.connection.getValue(
        this.rootPath,
        this.select.length ? {select: this.select} : undefined
      );
      if (this.disposed || generation !== this.generation) return;
      this.data = result.value;
      this.createChildren();
      if (!this.data || (this.data.constructor !== Object && !Array.isArray(this.data))) this.opened = 'empty';
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      this.error = String(error);
    } finally {
      if (!this.disposed && generation === this.generation) {
        this.loading = false;
        this.changed();
      }
    }
  }

  async loadMore() {
    if (this.loading || this.error || this.disposed || this.total === undefined || this.offset >= this.total) return;
    this.loading = true;
    this.addMore();
    this.changed();
    const generation = this.generation;
    try {
      const page = await this.connection.getValuePage(this.rootPath, {
        select: this.select,
        offset: this.offset,
        limit: pageSize,
        ...(this.offset ? {anchor: this.anchor} : {}),
      });
      if (this.disposed || generation !== this.generation) return;
      if (this.children.at(-1)?.more) this.children.pop().destroy();
      for (const [index, row] of page.items.entries())
        this.children.push(new ObjectTreeItem(this.rootPath, String(this.offset + index), row, this));
      this.offset += page.items.length;
      this.total = page.total;
      this.anchor = snapshotTransportValue(page.items.at(-1));
      if (this.offset < this.total) this.addMore();
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      this.error =
        error === 'page_anchor_mismatch' ? translateEditor('Value changed. Reload to continue.') : String(error);
    } finally {
      if (!this.disposed && generation === this.generation) {
        this.loading = false;
        this.changed();
      }
    }
  }

  reload = () => {
    ++this.generation;
    this.loading = false;
    this.error = undefined;
    this.offset = 0;
    this.total = undefined;
    this.destroyChildren();
    this.open();
  };

  onAttached() {
    if (this.more) void this.parent.loadMore();
  }

  destroy() {
    this.disposed = true;
    ++this.generation;
    super.destroy();
  }
}

interface Props {
  item: ObjectTreeItem;
  style: React.CSSProperties;
}

export class ObjectTreeRenderer extends PureDataRenderer<Props, any> {
  // static contextType = TicloLayoutContextType;
  // declare context: TicloLayoutContext;

  onExpandClicked = () => {
    const {item} = this.props;
    switch (item.opened) {
      case 'opened':
        item.close();
        break;
      case 'closed':
        item.open();
        break;
    }
  };

  onDragStart = (e: DragState) => {
    const {item} = this.props;

    const fields = [`${item.rootPath}..${item.key}`];
    e.setData({fields}, item.connection.getBaseConn());

    e.startDrag(undefined, undefined, {opacity: 0.9});
  };

  renderImpl() {
    const {item, style} = this.props;
    const marginLeft = item.level * 16;
    if (item.more) {
      const parent = item.parent;
      return (
        <div style={{...style, paddingLeft: marginLeft}} className="ticl-e-object-tree-more">
          {parent.error ? (
            <span className="ticl-e-error-message" title={parent.error}>
              {parent.error}
            </span>
          ) : null}
          <Button
            size="small"
            type="link"
            disabled={parent.loading}
            onClick={parent.error ? parent.reload : () => void parent.loadMore()}
          >
            {t(parent.loading ? 'Loading...' : parent.error ? 'Reload' : 'Load more')}
          </Button>
        </div>
      );
    }
    const onClick = item.opened !== 'empty' ? this.onExpandClicked : null;

    const onDragStart = item.rootPath ? this.onDragStart : null;

    let child: React.ReactNode;
    let val = item.data;
    switch (typeof val) {
      case 'string':
        if (val.length > 512) {
          val = `${val.substring(0, 128)}${TRUNCATED}`;
        }
        child = <span className="ticl-e-string-value">{val}</span>;
        break;
      case 'number':
        child = displayNumber(val);
        break;
      case 'object':
        if (val) {
          if (Array.isArray(val)) {
            child = `[ ${item.total ?? getTruncatedArrayLength(val) ?? val.length} ]`;
          } else if (val.constructor === Object) {
            child = `{ ${Object.keys(val).length - (Object.hasOwn(val, TRUNCATED) ? 1 : 0)} }`;
          } else {
            child = encodeDisplay(val);
          }
          break;
        }
      default:
        child = `${val}`;
    }

    return (
      <div style={{...style, marginLeft}} className="ticl-e-tree-node ticl-e-object-tree-item">
        <ExpandIcon opened={item.opened} onClick={onClick} />
        <DragDropDiv onDragStartT={onDragStart} className="ticl-e-hbox">
          <div className="ticl-e-object-tree-name">{item.name}</div>
          <div className="ticl-e-object-tree-value">{child}</div>
        </DragDropDiv>
      </div>
    );
  }
}
