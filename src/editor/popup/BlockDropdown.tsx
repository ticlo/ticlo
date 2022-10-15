import {showModal} from './ShowModal';
import {AddNewFlowDialog} from './AddNewFlowDialog';
import {NodeTreeItem} from '../node-tree/NodeRenderer';
import React from 'react';
import FileAddIcon from '@ant-design/icons/FileAddOutlined';
import {LocalizedFuncCommand, LocalizedPropCommand, t} from '../component/LocalizedLabel';
import BuildIcon from '@ant-design/icons/BuildOutlined';
import SaveIcon from '@ant-design/icons/SaveOutlined';
import DeleteIcon from '@ant-design/icons/DeleteOutlined';
import EditIcon from '@ant-design/icons/EditOutlined';
import PlayIcon from '@ant-design/icons/CaretRightOutlined';
import SearchIcon from '@ant-design/icons/SearchOutlined';
import {DataMap, FunctionDesc, PropDesc, smartStrCompare} from '../../core';
import {ClientConn} from '../../core/connect/ClientConn';
import {Popup, Menu, MenuItem} from '../component/ClickPopup';
import {RenameDialog} from './RenameDialog';
import {splitPathName} from '../../core/util/Path';
import {ParameterInputDialog} from './ParameterInputDialog';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext';

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
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

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

  onCloseCommandModal = () => {
    this.setState({modal: null});
  };
  onExeCommand = (command: string) => {
    let {conn, canApply, functionId, path} = this.props;
    let funcDesc = conn.watchDesc(functionId);
    let commandDesc = funcDesc.commands[command];
    if (commandDesc.parameters?.length) {
      let onConfirmCommandModal = (values: DataMap) => {
        conn.executeCommand(path, command, {...values, property: name});
        this.onCloseCommandModal();
      };
      let modal = (
        <ParameterInputDialog
          title={<LocalizedFuncCommand key={command} desc={funcDesc} command={command} />}
          funcName={`${funcDesc.name}.@commands.${command}`}
          parameters={commandDesc.parameters}
          ns={funcDesc.ns}
          onOk={onConfirmCommandModal}
          onCancel={this.onCloseCommandModal}
        />
      );
      this.setState({modal});
    } else {
      conn.executeCommand(path, command, {property: name});
    }
  };

  getMenu = () => {
    let {conn, canApply, functionId, getMenu} = this.props;
    let funcDesc = conn.watchDesc(functionId);

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

    if (funcDesc?.commands) {
      let commands = Object.keys(funcDesc.commands);
      if (commands.length) {
        commands.sort(smartStrCompare);
        for (let command of commands) {
          commandMenus.push(
            <MenuItem key={`cmd-${command}`} value={command} onClick={this.onExeCommand}>
              <LocalizedFuncCommand key={command} desc={funcDesc} command={command} />
            </MenuItem>
          );
        }
      }
    }

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

    return <Menu>{menuitems}</Menu>;
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
