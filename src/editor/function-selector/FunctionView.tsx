import React from 'react';
import {FunctionDesc, getDefaultFuncData, ClientConn} from '../../../src/core/editor';
import {TIcon} from '../icon/Icon';
import {DragDropDiv, DragState} from 'rc-dock/lib';
import {getFuncStyleFromDesc} from '../util/BlockColors';
import {Dropdown, Menu} from 'antd';
import BuildIcon from '@ant-design/icons/BuildOutlined';
import DeleteIcon from '@ant-design/icons/DeleteOutlined';
import EditIcon from '@ant-design/icons/EditOutlined';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext';
import {encodeURITiclo} from '../../core/util/String';

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
  context!: TicloLayoutContext;

  onDrag = (e: DragState) => {
    let {conn, data, desc} = this.props;

    if (!data) {
      data = getDefaultFuncData(desc);
    }

    e.setData(
      {
        blockName: desc.name,
        blockData: data
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
    let editPath = `#temp.#edit-${encodeURITiclo(desc.id)}`;
    conn.editWorker(editPath, null, desc.id);
    this.context.editJob(editPath, () => {
      conn.applyJobChange(editPath);
    });
  };
  onDeleteClicked = () => {
    let {conn, desc} = this.props;
    conn.deleteFunction(desc.id);
  };

  getMenu = () => {
    return (
      <Menu selectable={false}>
        <Menu.Item key="edit" onClick={this.onEditClicked}>
          <BuildIcon />
          Edit
        </Menu.Item>
        <Menu.Item key="rename">
          <EditIcon />
          Rename
        </Menu.Item>
        <Menu.Item key="delete" onClick={this.onDeleteClicked}>
          <DeleteIcon />
          Delete
        </Menu.Item>
      </Menu>
    );
  };

  render() {
    let {desc, name, conn} = this.props;
    if (!name) {
      name = desc.name;
    }
    let {ns} = desc;
    let [colorClass, iconName] = getFuncStyleFromDesc(desc, conn, 'ticl-bg--');
    let typeView = (
      <DragDropDiv className={`${colorClass} ticl-func-view`} onClick={this.onClick} onDragStartT={this.onDrag}>
        <TIcon icon={iconName} />
        {ns != null ? <span className="ticl-func-ns">{ns}</span> : null}
        <span className="ticl-func-name">{name}</span>
      </DragDropDiv>
    );

    if (ns === '' && desc.src === 'worker' && this.context.editJob) {
      return (
        <Dropdown overlay={this.getMenu} trigger={['contextMenu']}>
          {typeView}
        </Dropdown>
      );
    } else {
      return typeView;
    }
  }
}
