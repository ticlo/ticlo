import * as React from 'react';
import {DataRendererItem, PureDataRenderer} from "./DataRenderer";

export type ExpandState = 'opened' | 'closed' | 'loading' | 'empty' | 'disabled';

interface Props {
  opened: ExpandState;
  onClick: React.MouseEventHandler<HTMLElement>;
}

export function ExpandIcon(props: Props) {
  switch (props.opened) {
    case 'opened':
      return (
        <li
          onClick={props.onClick}
          className="anticon anticon-caret-right ticl-icn-expand"
          style={{transform: 'rotate(90deg)'}}
        />
      );
    case 'closed':
      return (
        <li
          onClick={props.onClick}
          className="anticon anticon-caret-right ticl-icn-expand"
        />
      );
    case 'loading':
      return (
        <li
          className="anticon anticon-loading anticon-spin ticl-icn-loading"
        />
      );
    case 'empty':
      return (
        <li
          onClick={props.onClick}
          className="anticon anticon-right ticl-icn-expand"
        />
      );
    default:
      return (
        <li
          className="anticon ticl-icn-expand"
        />
      );
  }
}

export class TreeItem extends DataRendererItem {
  opened: ExpandState = 'closed';

  children: TreeItem[] = null;

  addToList(list: TreeItem[]) {
    list.push(this);
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
