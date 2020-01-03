import React from 'react';
import {ExpandIcon} from '../../react/component/Tree';
import {TIcon} from '../icon/Icon';
import {blankFuncDesc, FunctionDesc, getFuncStyleFromDesc} from '../../core/block/Descriptor';
import {TypeView} from './TypeView';
import {TypeTreeItem} from './TypeTreeItem';
import {PureDataRenderer} from '../../react/component/DataRenderer';

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
    let {name, connection, desc, data} = item;
    let marginLeft = item.level * 24;
    if (desc) {
      return (
        <div style={{...style, marginLeft}} className="ticl-tree-type">
          <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
          <TypeView conn={connection} onClick={this.onTypeClick} desc={desc} name={name} data={data} />
        </div>
      );
    } else {
      let child = item.children[0];
      let icon: string;
      let funcStyle: string;
      if (child && child.desc) {
        icon = child.desc.icon;
        funcStyle = getFuncStyleFromDesc(child.desc, 'tico-pr');
      }
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
