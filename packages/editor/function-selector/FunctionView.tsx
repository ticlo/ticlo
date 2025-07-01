import React from 'react';
import {
  FunctionDesc,
  getDefaultFuncData,
  ClientConn,
  encodeTicloName,
  translateFunction,
  TicloI18nSettings,
} from '@ticlo/core';
import {TIcon} from '../icon/Icon';
import {DragDropDiv, DragState} from 'rc-dock';
import {getFuncStyleFromDesc} from '../util/BlockColors';
import {Dropdown, Menu} from 'antd';
import BuildIcon from '@ant-design/icons/BuildOutlined';
import DeleteIcon from '@ant-design/icons/DeleteOutlined';
import EditIcon from '@ant-design/icons/EditOutlined';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext';
import {LocalizedFunctionName, t} from '../component/LocalizedLabel';
import {MenuProps} from 'antd/lib/menu';

export type OnFunctionClick = (name: string, desc: FunctionDesc, data: any) => void;

interface Props {
  conn: ClientConn;
  desc: FunctionDesc;
  name?: any;
  data?: any;
  onClick?: OnFunctionClick;
}

export class FunctionView extends React.PureComponent<Props, any> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  onDrag = (e: DragState) => {
    let {conn, data, desc} = this.props;

    if (!data) {
      data = getDefaultFuncData(desc);
    }

    let name = desc.name;
    if (TicloI18nSettings.useLocalizedBlockName) {
      name = translateFunction(desc.id, desc.name, desc.ns);
    }
    e.setData(
      {
        blockName: name,
        blockData: data,
      },
      conn.getBaseConn()
    );
    e.startDrag();
  };

  onClick = (e: React.MouseEvent) => {
    let {onClick, desc, name, data} = this.props;
    if (onClick) {
      if (!name) {
        name = desc.name;
      }
      onClick(name, desc, data);
    }
  };
  onEditClicked = () => {
    let {conn, desc} = this.props;
    let editPath = `#temp.#edit-${encodeTicloName(desc.id)}`;
    conn.editWorker(editPath, null, desc.id);
    this.context.editFlow(editPath, () => {
      conn.applyFlowChange(editPath);
    });
  };
  onDeleteClicked = () => {
    let {conn, desc} = this.props;
    conn.deleteFunction(desc.id);
  };

  getMenu = (): MenuProps => {
    return {
      selectable: false,
      items: [
        {
          key: 'edit',
          onClick: this.onEditClicked,
          label: (
            <>
              <BuildIcon />
              {t('Edit')}
            </>
          ),
        },
        {
          key: 'rename',
          label: (
            <>
              <EditIcon />
              {t('Rename')}
            </>
          ),
        },
        {
          key: 'delete',
          onClick: this.onEditClicked,
          label: (
            <>
              <DeleteIcon />
              {t('Delete')}
            </>
          ),
        },
      ],
    };
  };

  render() {
    let {desc, conn} = this.props;
    let {ns} = desc;
    let [colorClass, iconName] = getFuncStyleFromDesc(desc, conn, 'ticl-bg--');
    let typeView = (
      <DragDropDiv className={`${colorClass} ticl-func-view`} onClick={this.onClick} onDragStartT={this.onDrag}>
        <TIcon icon={iconName} />
        {ns != null ? <span className="ticl-func-ns">{ns}</span> : null}
        <LocalizedFunctionName desc={desc} className="ticl-func-name" />
      </DragDropDiv>
    );

    if (ns === '' && desc.src === 'worker' && this.context.editFlow) {
      return (
        <Dropdown menu={this.getMenu()} trigger={['contextMenu']}>
          {typeView}
        </Dropdown>
      );
    } else {
      return typeView;
    }
  }
}
