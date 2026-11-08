import React from 'react';
import {ExpandIcon} from '../component/Tree.tsx';
import {TIcon} from '../icon/Icon.tsx';
import {Dropdown, MenuProps} from 'antd';
import {FolderFilled, PlusOutlined} from '@ant-design/icons';
import {blankFuncDesc, FunctionDesc} from '@ticlo/core';
import {FunctionView} from './FunctionView.tsx';
import {FunctionTreeItem} from './FunctionTreeItem.ts';
import {PureDataRenderer} from '../component/DataRenderer.ts';
import {getFuncStyleFromDesc} from '../util/BlockColors.ts';
import {LocalizedFunctionName, t} from '../component/LocalizedLabel.tsx';

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

  getFunctionModuleMenu = (): MenuProps => ({
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
        <div style={{...style, marginLeft}} className="ticl-e-tree-type">
          <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
          <FunctionView
            conn={connection}
            onClick={this.onFunctionClick}
            desc={desc}
            name={name}
            data={data}
            funcModule={item.root.funcModule}
          />
        </div>
      );
    } else {
      if (!desc) {
        if (name.includes(':')) {
          const nameParts = name.split(':');
          name = nameParts.at(-1);
          desc = {id: item.key, name, libraryId: nameParts[0]};
        } else {
          desc = {id: item.key, name};
        }
      }
      const [colorStyle, iconName] = getFuncStyleFromDesc(desc, item.getConn());
      const isFunctionModule =
        !item.root.inFlow && item.key.startsWith('+') && item.key.endsWith(':') && item.key.split(':').length > 2;
      const categoryView = (
        <div
          style={{...style, marginLeft}}
          className={isFunctionModule ? 'ticl-e-tree-type ticl-e-func-module' : 'ticl-e-tree-type'}
        >
          <ExpandIcon opened={item.opened} onClick={this.onExpandClicked} />
          <div className="ticl-e-func-folder" style={colorStyle}>
            <FolderFilled />
            <TIcon icon={iconName} />
          </div>
          <LocalizedFunctionName desc={desc} />
        </div>
      );
      if (isFunctionModule) {
        return (
          <Dropdown menu={this.getFunctionModuleMenu()} trigger={['contextMenu']}>
            {categoryView}
          </Dropdown>
        );
      }
      return categoryView;
    }
  }
}
