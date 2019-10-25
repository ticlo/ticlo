import React from 'react';

import {Dropdown, Button, Input, Icon, Menu, InputNumber} from 'antd';
import {ExpandIcon, ExpandState, TreeItem} from '../component/Tree';
import {PureDataRenderer} from '../component/DataRenderer';
import {ClickParam} from 'antd/lib/menu';
import {DragDropDiv} from 'rc-dock/lib';

export class ObjectTreeItem extends TreeItem<ObjectTreeItem> {
  childPrefix: string;
  name: string;
  data: any;

  constructor(name: string, data: any, parent?: ObjectTreeItem) {
    super(parent);
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
      children.push(new ObjectTreeItem(key, this.data[key], this));
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

  renderImpl() {
    let {item, style} = this.props;
    let marginLeft = item.level * 24;
    let onClick = item.opened !== 'empty' ? this.onExpandClicked : null;
    return (
      <div style={{...style, marginLeft}} className="ticl-tree-node">
        <ExpandIcon opened={item.opened} onClick={onClick} />
        <DragDropDiv>{item.name}</DragDropDiv>
      </div>
    );
  }
}
