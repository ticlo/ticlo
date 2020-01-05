import React from 'react';

import {ExpandIcon, ExpandState, TreeItem} from '../component/Tree';
import {PureDataRenderer} from '../component/DataRenderer';
import {DragDropDiv, DragState} from 'rc-dock/lib';
import {TRUNCATED} from '../../core/util/DataTypes';
import {displayNumber} from '../util/Types';
import {encodeDisplay} from '../../core/util/Serialize';

export class ObjectTreeItem extends TreeItem<ObjectTreeItem> {
  childPrefix: string;
  name: string;
  data: any;
  rootPath: string;

  constructor(rootPath: string, name: string, data: any, parent?: ObjectTreeItem) {
    super(parent);
    this.rootPath = rootPath;
    this.data = data;
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
    if (!data || (data.constructor !== Object && !Array.isArray(data))) {
      this.opened = 'empty';
    }
  }

  open() {
    this.opened = 'opened';
    if (!this.children) {
      this.createChildren();
    }
    this.onListChange();
    this.forceUpdate();
  }

  close() {
    this.opened = 'closed';
    this.onListChange();
    this.forceUpdate();
  }

  createChildren() {
    let children: ObjectTreeItem[] = [];
    for (let key of Object.keys(this.data)) {
      children.push(new ObjectTreeItem(this.rootPath, key, this.data[key], this));
    }
    this.children = children;
  }

  destroy() {
    // there is nothing to destroy();
    // super.destroy();
  }
}

interface Props {
  item: ObjectTreeItem;
  style: React.CSSProperties;
}

export class ObjectTreeRenderer extends PureDataRenderer<Props, any> {
  // static contextType = TicloLayoutContextType;
  // context!: TicloLayoutContext;

  onExpandClicked = () => {
    let {item} = this.props;
    switch (item.opened) {
      case 'opened':
        item.close();
        break;
      case 'closed':
        item.open();
        break;
    }
  };

  constructor(props: Props) {
    super(props);
    let {item} = props;
  }

  onDragStart = (e: DragState) => {
    let {item} = this.props;

    let fields = [`${item.rootPath}..${item.key}`];
    e.setData({fields}, item.connection.getBaseConn());

    e.startDrag();
  };

  renderImpl() {
    let {item, style} = this.props;
    let marginLeft = item.level * 16;
    let onClick = item.opened !== 'empty' ? this.onExpandClicked : null;

    let onDragStart = item.rootPath ? this.onDragStart : null;

    let child: React.ReactNode;
    let val = item.data;
    switch (typeof val) {
      case 'string':
        if (val.length > 512) {
          val = `${val.substr(0, 128)}${TRUNCATED}`;
        }
        child = <span className="ticl-string-value">{val}</span>;
        break;
      case 'number':
        child = displayNumber(val);
        break;
      case 'object':
        if (val) {
          if (Array.isArray(val)) {
            child = `[ ${val.length} ]`;
          } else if (val.constructor === Object) {
            child = `{ ${Object.keys(val).length} }`;
          } else {
            child = encodeDisplay(val);
          }
          break;
        }
      // tslint:disable-next-line:no-switch-case-fall-through
      default:
        child = `${val}`;
    }

    return (
      <div style={{...style, marginLeft}} className="ticl-tree-node ticl-object-tree-item">
        <ExpandIcon opened={item.opened} onClick={onClick} />
        <DragDropDiv onDragStartT={this.onDragStart} className="ticl-hbox">
          <div className="ticl-object-tree-name">{item.name}</div>
          <div className="ticl-object-tree-value">{child}</div>
        </DragDropDiv>
      </div>
    );
  }
}
