import React from 'react';
import {ExpandIcon} from '../component/Tree.js';
import {TIcon} from '../icon/Icon.js';
import {blankFuncDesc, FunctionDesc} from '@ticlo/core';
import {FunctionView} from './FunctionView.js';
import {FunctionTreeItem} from './FunctionTreeItem.js';
import {PureDataRenderer} from '../component/DataRenderer.js';
import {getFuncStyleFromDesc} from '../util/BlockColors.js';
import {LocalizedFunctionName} from '../component/LocalizedLabel.js';

interface Props {
  item: FunctionTreeItem;
  style?: React.CSSProperties;
}

export class FunctionTreeRenderer extends PureDataRenderer<Props, any> {
  onExpandClicked = () => {
    const {item} = this.props;
    switch (item.opened) {
      case 'opened':
        item.close();
        break;
      case 'empty':
        if (item.children.length === 0) {
          return;
        }
      case 'closed':
        item.open();
        break;
    }
  };

  onFunctionClick = (name: string, desc: FunctionDesc, data: any) => {
    const {onFunctionClick} = this.props.item.root;
    if (onFunctionClick) {
      onFunctionClick(name, desc, data);
    }
  };

  renderImpl() {
    const {item, style} = this.props;
    let {name, connection, desc, data, key} = item;
    const marginLeft = item.level * 24;
    if (desc?.properties) {
      return (
        <div style={{...style, marginLeft}} className="ticl-tree-type">
          <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
          <FunctionView conn={connection} onClick={this.onFunctionClick} desc={desc} name={name} data={data} />
        </div>
      );
    } else {
      if (!desc) {
        if (name.includes(':')) {
          const nameParts = name.split(':');
          name = nameParts.at(-1);
          desc = {id: item.key, name, ns: nameParts[0]};
        } else {
          desc = {id: item.key, name};
        }
      }
      const [colorClass, iconName] = getFuncStyleFromDesc(desc, item.getConn(), 'ticl-bg--');
      return (
        <div style={{...style, marginLeft}} className="ticl-tree-type">
          <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
          <TIcon icon={iconName} colorClass={colorClass} />
          <LocalizedFunctionName desc={desc} />
        </div>
      );
    }
  }
}
