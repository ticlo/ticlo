import {showModal} from './ShowModal';
import {AddNewFlowDialog} from './AddNewFlowDialog';
import {NodeTreeItem} from '../node-tree/NodeRenderer';
import React from 'react';
import {Menu} from 'antd';
import FileAddIcon from '@ant-design/icons/FileAddOutlined';
import {LocalizedPropCommand, t} from '../component/LocalizedLabel';
import BuildIcon from '@ant-design/icons/BuildOutlined';
import SaveIcon from '@ant-design/icons/SaveOutlined';
import DeleteIcon from '@ant-design/icons/DeleteOutlined';
import EditIcon from '@ant-design/icons/EditOutlined';
import SearchIcon from '@ant-design/icons/SearchOutlined';
import {FunctionDesc, PropDesc} from '../../core';
import {ClientConn} from '../../core/connect/ClientConn';
import {Popup} from '../component/ClickPopup';
import {RenameDialog} from './RenameDialog';

const deleteForbidden = new Set<string>(['flow:test-group', 'flow:const']);
const renameForbidden = new Set<string>(['flow:test-group', 'flow:const']);

interface Props {
  children: React.ReactElement;
  functionId: string;
  conn: ClientConn;
  path: string;
  displayName: string;
  canApply: boolean;
  getMenu?: () => React.ReactElement[];
}

interface State {
  visible: boolean;
  modal?: React.ReactElement;
}

export class BlockDropdown extends React.PureComponent<Props, State> {
  state: State = {visible: false};

  closeMenu = () => {
    this.setState({visible: false});
  };

  onMenuVisibleChange = (visible: boolean) => {
    this.setState({visible});
  };

  onSaveClicked = () => {
    let {conn, path} = this.props;
    conn.applyFlowChange(path);
  };

  onDeleteClicked = () => {
    let {conn, path} = this.props;
    conn.setValue(path, undefined);
    // item.parent?.open();
  };

  onRenameClicked = () => {
    let {conn, path, displayName} = this.props;
    showModal(<RenameDialog conn={conn} path={path} displayName={displayName} />, this.context.showModal);
  };

  onAddNewFlowClick = (param: any) => {
    let {conn, path} = this.props;
    showModal(<AddNewFlowDialog conn={conn} basePath={`${path}.`} />, this.context.showModal);
  };

  getMenu = () => {
    let {canApply, functionId, getMenu} = this.props;

    let menuitems: React.ReactElement[] = [];
    if (getMenu) {
      menuitems = menuitems.concat(getMenu());
    }
    if (canApply) {
      menuitems.push(
        <Menu.Item key="save" onClick={this.onSaveClicked}>
          <SaveIcon />
          {t('Save')}
        </Menu.Item>
      );
    }
    if (!deleteForbidden.has(functionId)) {
      menuitems.push(
        <Menu.Item key="delete" onClick={this.onDeleteClicked}>
          <DeleteIcon />
          {t('Delete')}
        </Menu.Item>
      );
    }
    if (!renameForbidden.has(functionId)) {
      menuitems.push(
        <Menu.Item key="rename" onClick={this.onRenameClicked}>
          <EditIcon />
          {t('Rename')}
        </Menu.Item>
      );
    }

    return (
      <Menu prefixCls="ant-dropdown-menu" selectable={false} onClick={this.closeMenu}>
        {menuitems}
      </Menu>
    );
  };

  render(): any {
    let {children} = this.props;
    let {visible, modal} = this.state;
    let popup = visible ? this.getMenu() : null;
    return (
      <>
        <Popup
          popup={popup}
          trigger={['contextMenu']}
          popupVisible={visible}
          onPopupVisibleChange={this.onMenuVisibleChange}
        >
          {children}
        </Popup>
        {modal}
      </>
    );
  }
}
