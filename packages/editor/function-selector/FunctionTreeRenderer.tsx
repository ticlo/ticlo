import React from 'react';
import {ExpandIcon} from '../component/Tree.js';
import {TIcon} from '../icon/Icon.js';
import {Dropdown, MenuProps} from 'antd';
import {PlusOutlined} from '@ant-design/icons';
import {blankFuncDesc, FunctionDesc} from '@ticlo/core';
import {FunctionView} from './FunctionView.js';
import {FunctionTreeItem} from './FunctionTreeItem.js';
import {PureDataRenderer} from '../component/DataRenderer.js';
import {getFuncStyleFromDesc} from '../util/BlockColors.js';
import {LocalizedFunctionName, t} from '../component/LocalizedLabel.js';

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

  onAddFunction = () => {
    const {item} = this.props;
    item.root.onAddFunction?.(item.key);
  };

  getFunctionLibMenu = (): MenuProps => ({
    selectable: false,
    items: [
      {
        key: 'addFunction',
        onClick: this.onAddFunction,
        label: (
          <>
            <PlusOutlined />
            {t('Add Function')}
          </>
        ),
      },
    ],
  });

  renderImpl() {
    const {item, style} = this.props;
    let {name, connection, desc, data, key} = item;
    const marginLeft = item.level * 24;
    if (desc?.properties) {
      return (
        <div style={{...style, marginLeft}} className="ticl-tree-type">
          <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
          <FunctionView
            conn={connection}
            onClick={this.onFunctionClick}
            desc={desc}
            name={name}
            data={data}
            funcLib={item.root.funcLib}
          />
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
      const isFunctionLib =
        !item.root.inFlow && item.key.startsWith('+') && item.key.endsWith(':') && item.key.split(':').length > 2;
      const categoryView = (
        <div
          style={{...style, marginLeft}}
          className={isFunctionLib ? 'ticl-tree-type ticl-func-lib' : 'ticl-tree-type'}
        >
          <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
          <TIcon icon={iconName} colorClass={colorClass} />
          <LocalizedFunctionName desc={desc} />
        </div>
      );
      if (isFunctionLib) {
        return (
          <Dropdown menu={this.getFunctionLibMenu()} trigger={['contextMenu']}>
            {categoryView}
          </Dropdown>
        );
      }
      return categoryView;
    }
  }
}
