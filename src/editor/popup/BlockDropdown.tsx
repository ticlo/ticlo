import {showModal} from './ShowModal';
import {AddNewFlowDialog} from './AddNewFlowDialog';
import {NodeTreeItem} from '../node-tree/NodeRenderer';
import React from 'react';
import FileAddIcon from '@ant-design/icons/FileAddOutlined';
import {LocalizedPropCommand, t} from '../component/LocalizedLabel';
import BuildIcon from '@ant-design/icons/BuildOutlined';
import SaveIcon from '@ant-design/icons/SaveOutlined';
import DeleteIcon from '@ant-design/icons/DeleteOutlined';
import EditIcon from '@ant-design/icons/EditOutlined';
import PlayIcon from '@ant-design/icons/CaretRightOutlined';
import SearchIcon from '@ant-design/icons/SearchOutlined';
import {FunctionDesc, PropDesc} from '../../core';
import {ClientConn} from '../../core/connect/ClientConn';
import {Popup, Menu, MenuItem} from '../component/ClickPopup';
import {RenameDialog} from './RenameDialog';
import {splitPathName} from '../../core/util/Path';

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
}

export class BlockDropdown extends React.PureComponent<Props, State> {
  state: State = {visible: false};

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
    conn.childrenChangeStream().dispatch({path: splitPathName(path)[0]});
  };

  onRenameClicked = () => {
    let {conn, path, displayName} = this.props;
    showModal(<RenameDialog conn={conn} path={path} displayName={displayName} />, this.context.showModal);
  };

  onCallClicked = () => {
    let {conn, path} = this.props;
    conn.callFunction(path);
  };
  onAddNewFlowClick = (param: any) => {
    let {conn, path} = this.props;
    showModal(<AddNewFlowDialog conn={conn} basePath={`${path}.`} />, this.context.showModal);
  };

  getMenu = () => {
    let {conn, canApply, functionId, getMenu} = this.props;

    let menuitems: React.ReactElement[] = [];
    if (getMenu) {
      menuitems = menuitems.concat(getMenu());
    }
    if (canApply) {
      menuitems.push(
        <MenuItem key="save" onClick={this.onSaveClicked}>
          <SaveIcon />
          {t('Save')}
        </MenuItem>
      );
    }
    if (!deleteForbidden.has(functionId)) {
      menuitems.push(
        <MenuItem key="delete" onClick={this.onDeleteClicked}>
          <DeleteIcon />
          {t('Delete')}
        </MenuItem>
      );
    }
    if (!renameForbidden.has(functionId)) {
      menuitems.push(
        <MenuItem key="rename" onClick={this.onRenameClicked}>
          <EditIcon />
          {t('Rename')}
        </MenuItem>
      );
    }

    let showCallMenu = !functionId.startsWith('flow:');
    let commandMenus: React.ReactElement[] = [];

    if (showCallMenu || commandMenus.length) {
      menuitems.push(
        <MenuItem key="divider">
          <div className="ticl-property-divider">
            {t('Execute Command')}
            <div className="ticl-h-line" />
          </div>
        </MenuItem>
      );

      if (showCallMenu) {
        menuitems.push(
          <MenuItem key="call" onClick={this.onCallClicked}>
            <PlayIcon />
            {t('Call')}
          </MenuItem>
        );
      }

      menuitems.push(...commandMenus);
    }

    return (
      <Menu>
        {menuitems}
      </Menu>
    );
  };

  render(): any {
    let {children} = this.props;
    let {visible} = this.state;
    let popup = visible ? this.getMenu() : null;
    return (
      <Popup
        popup={popup}
        trigger={['contextMenu']}
        popupVisible={visible}
        onPopupVisibleChange={this.onMenuVisibleChange}
      >
        {children}
      </Popup>
    );
  }
}
