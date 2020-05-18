import React from 'react';
import {ExpandIcon} from '../component/Tree';
import {TIcon} from '../icon/Icon';
import {blankFuncDesc, FunctionDesc} from '../../../src/core/editor';
import {FunctionView} from './FunctionView';
import {FunctionTreeItem} from './FunctionTreeItem';
import {PureDataRenderer} from '../component/DataRenderer';
import {getFuncStyleFromDesc} from '../util/BlockColors';
import {LocalizedFunctionName} from '../component/LocalizedLabel';

interface Props {
  item: FunctionTreeItem;
  style?: React.CSSProperties;
}

export class FunctionTreeRenderer extends PureDataRenderer<Props, any> {
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

  onFunctionClick = (name: string, desc: FunctionDesc, data: any) => {
    let {onFunctionClick} = this.props.item.root;
    if (onFunctionClick) {
      onFunctionClick(name, desc, data);
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
          <FunctionView conn={connection} onClick={this.onFunctionClick} desc={desc} name={name} data={data} />
        </div>
      );
    } else {
      if (!desc) {
        if (name.includes(':')) {
          let nameParts = name.split(':');
          name = nameParts[nameParts.length - 1];
          desc = {ns: nameParts[0], name};
        } else {
          desc = {id: item.key, name};
        }
      }
      let [colorClass, iconName] = getFuncStyleFromDesc(desc, item.getConn(), 'ticl-bg--');
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
