import React from 'react';
import {ExpandIcon} from '../component/Tree';
import {TIcon} from '../icon/Icon';
import {blankFuncDesc, FunctionDesc} from '../../../src/core/editor';
import {TypeView} from './TypeView';
import {TypeTreeItem} from './TypeTreeItem';
import {PureDataRenderer} from '../component/DataRenderer';
import {getFuncStyleFromDesc} from '../util/BlockColors';

interface Props {
  item: TypeTreeItem;
  style?: React.CSSProperties;
}

export class TypeTreeRenderer extends PureDataRenderer<Props, any> {
  onExpandClicked = () => {
    let {item} = this.props;
    switch (item.opened) {
      case 'opened':
        item.close();
        break;
      case 'empty':
        if (item.children.length === 0) {
          return;
        }
      // tslint:disable-next-line:no-switch-case-fall-through
      case 'closed':
        item.open();
        break;
    }
  };

  onTypeClick = (name: string, desc: FunctionDesc, data: any) => {
    let {onTypeClick} = this.props.item.root;
    if (onTypeClick) {
      onTypeClick(name, desc, data);
    }
  };

  renderImpl() {
    let {item, style} = this.props;
    let {name, connection, desc, data, key} = item;
    let marginLeft = item.level * 24;
    if (desc?.properties) {
      return (
        <div style={{...style, marginLeft}} className="ticl-tree-type">
          <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
          <TypeView conn={connection} onClick={this.onTypeClick} desc={desc} name={name} data={data} />
        </div>
      );
    } else {
      let icon = desc?.icon;
      let funcStyle = getFuncStyleFromDesc(desc, 'ticl-bg--');
      return (
        <div style={{...style, marginLeft}} className="ticl-tree-type">
          <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
          <TIcon icon={icon} style={funcStyle} />
          <span>{name}</span>
        </div>
      );
    }
  }
}
