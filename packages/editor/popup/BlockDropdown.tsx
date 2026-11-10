import {showModal} from './ShowModal.tsx';
import {AddNewFlowDialog} from './AddNewFlowDialog.tsx';
import {NodeTreeItem} from '../node-tree/NodeRenderer.tsx';
import React from 'react';
import {
  BuildOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  EditOutlined,
  FileAddOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {LocalizedFuncCommand, LocalizedPropCommand, t} from '../component/LocalizedLabel.tsx';

import {DataMap, FunctionDesc, PropDesc, smartStrCompare} from '@ticlo/core';
import {ClientConn} from '@ticlo/core/connect/ClientConn.ts';
import {Popup, Menu, MenuItem, SubMenuItem} from '../component/ClickPopup.tsx';
import {RenameDialog} from './RenameDialog.tsx';
import {splitPathName} from '@ticlo/core/util/Path.ts';
import {CommandMenu} from './CommandMenu.tsx';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext.ts';
import {getDescModule} from '../util/FunctionModule.ts';
import {EditPolicyContext} from '../component/EditPolicyContext.tsx';
import {requestCallbacks} from '../util/RequestCallbacks.ts';

const deleteForbidden = new Set<string>(['flow:test-group', 'flow:const']);
const renameForbidden = new Set<string>(['flow:test-group', 'flow:const']);

interface Props {
  checkPolicy?: boolean;
  children: React.ReactElement;
  functionId: string;
  conn: ClientConn;
  path: string;
  displayName: string;
  canApply: boolean;
  funcModule?: string;
  // When disabled is null, don't show the menu item.
  disabled?: boolean;
  getMenu?: () => React.ReactElement[];
  menuVersion?: boolean;
  onMenuOpen?: () => void;
}

interface State {
  visible: boolean;
}

export class BlockDropdown extends React.PureComponent<Props, State> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  state: State = {visible: false};
  private menuOpened = false;

  can(cmd: string, data: DataMap = {}) {
    if (!this.props.checkPolicy) return true;
    const {conn, path} = this.props;
    const policy = conn.getEditPolicyView();
    if (cmd === 'delete') return policy.canDeleteBlock(path);
    return policy.can({cmd, path, ...data});
  }

  onMenuVisibleChange = (visible: boolean) => {
    if (visible) this.menuOpened = true;
    if (visible) this.props.onMenuOpen?.();
    this.setState({visible});
  };

  onSaveClicked = () => {
    if (!this.can('applyFlowChange')) return;
    const {conn, path} = this.props;
    conn.applyFlowChange(path, undefined, requestCallbacks);
  };

  onDeleteClicked = () => {
    if (!this.can('delete')) return;
    const {conn, path} = this.props;
    conn.deleteBlock(path, {
      ...requestCallbacks,
      onDone: () => conn.childrenChangeStream().dispatch({path: splitPathName(path)[0]}),
    });
  };

  onRenameClicked = () => {
    if (!this.can('renameProp')) return;
    const {conn, path, displayName} = this.props;
    showModal(
      <RenameDialog conn={conn} path={path} displayName={displayName} checkPolicy={this.props.checkPolicy} />,
      this.context.showModal
    );
  };

  onEnableClicked = () => {
    const {conn, path} = this.props;
    if (!this.can('update', {path: `${path}.#disabled`})) return;
    conn.updateValue(`${path}.#disabled`, undefined);
  };
  onDisableClicked = () => {
    const {conn, path} = this.props;
    if (!this.can('update', {path: `${path}.#disabled`})) return;
    conn.updateValue(`${path}.#disabled`, true);
  };

  onCallClicked = () => {
    if (!this.can('callFunction')) return;
    const {conn, path} = this.props;
    conn.callFunction(path);
  };
  onAddNewFlowClick = (param: any) => {
    const {conn, path} = this.props;
    showModal(<AddNewFlowDialog conn={conn} basePath={`${path}.`} />, this.context.showModal);
  };

  onManageDatabase = () => {
    const {conn, path} = this.props;
    this.context.manageDatabase?.(conn, path);
  };
  onExeCommand = (command: string) => {
    if (!this.can('executeCommand', {command})) return;
    const {conn, functionId, path, funcModule} = this.props;
    const funcDesc = conn.watchDesc(functionId, getDescModule(functionId, funcModule));
    const commandDesc = funcDesc.commands[command];
    conn.executeCommand(path, command, {}, requestCallbacks, commandDesc);
  };

  getMenu = () => {
    const {conn, canApply, disabled, functionId, getMenu, funcModule} = this.props;
    const funcDesc = conn.watchDesc(functionId, getDescModule(functionId, funcModule));

    let menuitems: React.ReactElement[] = [];
    if (getMenu) {
      menuitems = menuitems.concat(getMenu());
    }
    if (canApply && this.can('applyFlowChange')) {
      menuitems.push(
        <MenuItem key="save" onClick={this.onSaveClicked}>
          <SaveOutlined />
          {t('Save')}
        </MenuItem>
      );
    }
    if (!deleteForbidden.has(functionId) && this.can('delete')) {
      menuitems.push(
        <MenuItem key="delete" onClick={this.onDeleteClicked}>
          <DeleteOutlined />
          {t('Delete')}
        </MenuItem>
      );
    }
    if (!renameForbidden.has(functionId) && this.can('renameProp')) {
      menuitems.push(
        <MenuItem key="rename" onClick={this.onRenameClicked}>
          <EditOutlined />
          {t('Rename')}
        </MenuItem>
      );
    }

    if (disabled === true && this.can('update', {path: `${this.props.path}.#disabled`})) {
      menuitems.push(
        <MenuItem key="enable" onClick={this.onEnableClicked}>
          <PlayCircleOutlined />
          {t('Enable')}
        </MenuItem>
      );
    } else if (disabled === false && this.can('update', {path: `${this.props.path}.#disabled`})) {
      menuitems.push(
        <MenuItem key="disable" onClick={this.onDisableClicked}>
          <PauseCircleOutlined />
          {t('Disable')}
        </MenuItem>
      );
    }

    const showCallMenu = !functionId.startsWith('flow:') && this.can('callFunction');
    const commandMenus: React.ReactElement[] = [];

    if (funcDesc?.tags?.includes('sql-client') && this.context.manageDatabase) {
      menuitems.push(
        <MenuItem key="database" onClick={this.onManageDatabase}>
          <DatabaseOutlined />
          {t('Manage database')}
        </MenuItem>
      );
    }

    if (funcDesc?.commands) {
      const commands = Object.keys(funcDesc.commands);
      if (commands.length) {
        commands.sort(smartStrCompare);
        for (const command of commands) {
          if (funcDesc.commands[command].hidden || !this.can('executeCommand', {command})) continue;
          const desc = funcDesc.commands[command];
          if (desc.parameters?.length || desc.results?.length) {
            commandMenus.push(
              <SubMenuItem
                key={`cmd-${command}`}
                popup={
                  <CommandMenu
                    key={`${this.props.path}:${functionId}:${command}`}
                    conn={conn}
                    paths={[this.props.path]}
                    command={command}
                    desc={desc}
                    funcDesc={{name: `${funcDesc.name}.@commands.${command}`, libraryId: funcDesc.libraryId}}
                  />
                }
              >
                <LocalizedFuncCommand desc={funcDesc} command={command} />
              </SubMenuItem>
            );
            continue;
          }
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
          <div className="ticl-e-property-divider">
            {t('Execute Command')}
            <div className="ticl-e-h-line" />
          </div>
        </MenuItem>
      );

      if (showCallMenu) {
        menuitems.push(
          <MenuItem key="call" onClick={this.onCallClicked}>
            <CaretRightOutlined />
            {t('Call')}
          </MenuItem>
        );
      }

      menuitems.push(...commandMenus);
    }

    return menuitems.length ? <Menu>{menuitems}</Menu> : null;
  };

  render(): any {
    const {children} = this.props;
    const {visible} = this.state;
    return (
      <EditPolicyContext.Consumer>
        {() => (
          <Popup
            popup={this.menuOpened ? this.getMenu : null}
            trigger={['contextMenu']}
            popupVisible={visible}
            onPopupVisibleChange={this.onMenuVisibleChange}
          >
            {children}
          </Popup>
        )}
      </EditPolicyContext.Consumer>
    );
  }
}
