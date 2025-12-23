import React from 'react';
import {DataRendererItem, PureDataRenderer} from './DataRenderer.js';
import {ClientConn} from '@ticlo/core/editor.js';

export type ExpandState = 'opened' | 'closed' | 'loading' | 'empty' | 'disabled';

interface Props {
  opened: ExpandState;
  onClick: React.MouseEventHandler<HTMLElement>;
}

export function ExpandIcon(props: Props) {
  switch (props.opened) {
    case 'opened':
      return (
        <div
          onClick={props.onClick}
          className="ticl-tree-arr ticl-tree-arr-expand"
          style={{transform: 'rotate(90deg)'}}
        />
      );
    case 'closed':
      return <div onClick={props.onClick} className="ticl-tree-arr ticl-tree-arr-expand" />;
    case 'loading':
      return <div className="ticl-tree-arr ticl-tree-arr-loading" />;
    case 'empty':
      return <div onClick={props.onClick} className="ticl-tree-arr ticl-tree-arr-empty" />;
    default:
      return <div className="ticl-tree-arr" />;
  }
}

export abstract class TreeItem<T extends TreeItem<any>> extends DataRendererItem {
  key: string;
  level: number;
  opened: ExpandState = 'closed';
  onListChange: () => void;

  parent: T;

  connection: ClientConn;

  getConn(): ClientConn {
    return this.connection;
  }

  getBaseConn(): ClientConn {
    return this.connection?.getBaseConn();
  }

  children: T[] = null;

  constructor(parent: T) {
    super();
    this.parent = parent;
    if (parent) {
      this.level = parent.level + 1;
      this.onListChange = parent.onListChange;
      this.connection = parent.connection;
    } else {
      this.level = 0;
    }
  }

  addToList(list: TreeItem<T>[]) {
    if (this.level >= 0) {
      list.push(this);
    }
    if (this.opened === 'opened' && this.children) {
      for (let child of this.children) {
        child.addToList(list);
      }
    }
  }

  destroyChildren() {
    if (this.children) {
      for (let child of this.children) {
        child.destroy();
      }
      this.children = null;
    }
  }

  destroy() {
    this.destroyChildren();
  }
}
