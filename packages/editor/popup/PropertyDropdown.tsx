import React from 'react';
import {Menu, Popup, SubMenuItem, MenuItem} from '../component/ClickPopup.tsx';
import {FunctionSelect} from '../function-selector/FunctionSelect.tsx';
import {
  blankFuncDesc,
  blankPropDesc,
  DataMap,
  FunctionCommandDesc,
  FunctionDesc,
  getDefaultFuncData,
  getSubBlockFuncData,
  getTailingNumber,
  Logger,
  PropDesc,
  PropGroupDesc,
  smartStrCompare,
  stopPropagation,
} from '@ticlo/core';
import {LocalizedPropCommand, LocalizedPropertyName, t} from '../component/LocalizedLabel.tsx';
import {Button, Checkbox} from 'antd';
import {DeleteOutlined} from '@ant-design/icons';
import {StringEditor} from '../property/value/StringEditor.tsx';
import {AddCustomPropertyMenu} from '../property/AddCustomProperty.tsx';
import {ClientConn, ValueSubscriber} from '@ticlo/core/connect/ClientConn.ts';
import {CheckboxChangeEvent} from 'antd';
import {ParameterInputDialog} from './ParameterInputDialog.tsx';
import {ExpandIcon} from '../component/Tree.tsx';
import {ValueUpdate} from '@ticlo/core/connect/ClientRequests.ts';
import {getDescLib} from '../util/FunctionLib.ts';
import {EditPolicyContext} from '../component/EditPolicyContext.tsx';

interface Props {
  children: React.ReactElement;
  funcDesc: FunctionDesc;
  propDesc: PropDesc;
  bindingPath: string;
  conn: ClientConn;
  group?: string;
  valueDefined?: boolean;
  isTemp?: boolean;
  isCustom?: boolean;
  // whether property is shown in block view
  display: boolean;
  paths: string[];
  name: string;
  baseName?: string;
  funcLib?: string;
  onAddSubBlock: (id: string, desc?: FunctionDesc, data?: any) => void;
}

const PendingUpdate = <div />;
interface State {
  visible: boolean;
  isTempOverride?: boolean;
  valueDenfinedOverride?: boolean;
  modal?: React.ReactElement;
}
export class PropertyDropdown extends React.PureComponent<Props, State> {
  static contextType = EditPolicyContext;
  declare context: React.ContextType<typeof EditPolicyContext>;

  can(cmd: string, data: DataMap = {}) {
    const {paths, name, propDesc} = this.props;
    const fieldCommand = ['set', 'bind', 'restoreSaved'].includes(cmd);
    if (fieldCommand && propDesc.readonly) return false;
    return paths.every((path) =>
      this.context.can({
        cmd,
        path: cmd === 'addBlock' ? `${path}.~${name}` : fieldCommand ? `${path}.${name}` : path,
        ...data,
      })
    );
  }
  state: State = {visible: false};

  subscriber = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      const {value, temp} = response.cache;
      this.setState({valueDenfinedOverride: value !== undefined, isTempOverride: temp});
    },
  });

  componentDidMount() {
    const {conn, valueDefined, paths, name} = this.props;
    if (valueDefined === undefined && paths?.length === 1) {
      // when parent component doesn't know the value, subscribe the value inside the
      this.subscriber.subscribe(conn, `${paths[0]}.${name}`);
    }
  }

  componentWillUnmount() {
    this.subscriber.unsubscribe();
  }

  closeMenu() {
    this.setState({visible: false});
  }

  onMenuVisibleChange = (visible: boolean) => {
    this.setState({visible});
  };

  onInsertIndex = () => {
    if (!this.can('insertGroupProp')) return;
    const {conn, paths, name, group} = this.props;
    const index = getTailingNumber(name);
    for (const path of paths) {
      conn.insertGroupProp(path, group, index);
    }
    this.closeMenu();
  };
  onDeleteIndex = () => {
    if (!this.can('removeGroupProp')) return;
    const {conn, paths, name, group} = this.props;
    const index = getTailingNumber(name);
    for (const path of paths) {
      conn.removeGroupProp(path, group, index);
    }
    this.closeMenu();
  };

  onClear = () => {
    if (!this.can('set')) return;
    const {conn, paths, name} = this.props;
    for (const path of paths) {
      conn.setValue(`${path}.${name}`, undefined);
    }
    this.closeMenu();
  };
  onRestoreSaved = () => {
    if (!this.can('restoreSaved')) return;
    const {conn, paths, name} = this.props;
    for (const path of paths) {
      conn.restoreSaved(`${path}.${name}`);
    }
    this.closeMenu();
  };
  onShowHide = (e: CheckboxChangeEvent) => {
    if (!this.can(e.target.checked ? 'showProps' : 'hideProps')) return;
    const {conn, paths, name} = this.props;
    for (const path of paths) {
      if (e.target.checked) {
        conn.showProps(path, [name]);
      } else {
        conn.hideProps(path, [name]);
      }
    }
  };
  onBindChange = (str: string) => {
    if (!this.can('bind')) return;
    const {conn, paths, name} = this.props;
    if (str === '') {
      str = undefined;
    }
    for (const key of paths) {
      conn.setBinding(`${key}.${name}`, str);
    }
  };
  onUnbindClick = (e: any) => {
    if (!this.can('bind')) return;
    const {conn, paths, name} = this.props;
    for (const key of paths) {
      conn.setBinding(`${key}.${name}`, null, true);
    }
  };
  onRemoveCustom = () => {
    if (!this.can('removeCustomProp')) return;
    const {conn, paths, name, baseName, group} = this.props;
    const removeField = baseName != null ? baseName : name;
    for (const path of paths) {
      conn.removeCustomProp(path, removeField, group);
    }
    this.closeMenu();
  };
  onAddCustomGroupChild = (desc: PropDesc | PropGroupDesc) => {
    if (!this.can('addCustomProp')) return;
    const {conn, group, paths} = this.props;
    for (const path of paths) {
      conn.addCustomProp(path, desc, group);
    }
    this.closeMenu();
  };
  onCloseCommandModal = () => {
    this.setState({modal: null});
  };

  onExeCommand = (command: string) => {
    if (!this.can('executeCommand')) return;
    const {conn, paths, name, funcDesc, propDesc} = this.props;
    const commandDesc = propDesc.commands[command];
    if (commandDesc.parameters?.length) {
      const onConfirmCommandModal = (values: DataMap) => {
        if (!this.can('executeCommand')) return;
        for (const path of paths) {
          conn.executeCommand(path, command, {...values, property: name});
        }
        this.onCloseCommandModal();
      };
      const modal = (
        <ParameterInputDialog
          title={
            <LocalizedPropCommand key={command} funcDesc={funcDesc} propBaseName={propDesc.name} command={command} />
          }
          funcName={`${funcDesc.name}.${propDesc.name}.@commands.${command}`}
          parameters={commandDesc.parameters}
          ns={funcDesc.ns}
          onOk={onConfirmCommandModal}
          onCancel={this.onCloseCommandModal}
        />
      );
      this.setState({modal});
    } else {
      for (const path of paths) {
        conn.executeCommand(path, command, {property: name});
      }
    }
  };

  static addSubBlock(
    props: {
      conn: ClientConn;
      paths: string[];
      name: string;
      funcLib?: string;
    },
    funcId: string,
    desc?: FunctionDesc,
    data?: any
  ) {
    const {conn, paths, name, funcLib} = props;
    if (!desc) {
      desc = conn.watchDesc(funcId, getDescLib(funcId, funcLib));
    }
    if (!data) {
      if (!desc) {
        Logger.error('unable to add sub block, missing id or desc or data', this);
        return;
      }
      data = getSubBlockFuncData(getDefaultFuncData(desc));
    }

    if (!paths.every((path) => conn.getEditPolicyView().canCreateBlock(`${path}.~${name}`, funcId))) return;
    for (const path of paths) {
      conn.addBlock(`${path}.~${name}`, data);
    }
  }

  onAddSubBlock = (id: string, desc?: FunctionDesc, data?: any) => {
    if (!this.can('addBlock', {data: data ?? {'#is': id}})) return;
    const {onAddSubBlock} = this.props;
    this.setState({visible: false});
    onAddSubBlock?.(id, desc, data);
  };

  getMenu() {
    const {funcDesc, propDesc, bindingPath, group, name, conn, valueDefined, isCustom, isTemp, display, funcLib} =
      this.props;
    const {valueDenfinedOverride, isTempOverride} = this.state;
    const menuItems: React.ReactElement[] = [];
    if (!propDesc.readonly) {
      if (!bindingPath && this.can('addBlock')) {
        menuItems.push(
          <SubMenuItem
            key="addSubBlock"
            popup={
              // <Menu.Item className='ticl-type-submenu'>
              <FunctionSelect
                onClick={stopPropagation}
                conn={conn}
                showPreset={true}
                onFunctionClick={this.onAddSubBlock}
                funcLib={funcLib}
              />
              // </Menu.Item>
            }
          >
            {t('Add Sub Block')}
          </SubMenuItem>
        );
      }
      if (this.can('bind')) {
        menuItems.push(
          <div key="deleteBinding" className="ticl-hbox">
            <span style={{flex: '0 1 100%'}}>{t('Binding')}:</span>
            {bindingPath ? (
              <Button
                className="ticl-icon-btn"
                shape="circle"
                size="small"
                icon={<DeleteOutlined />}
                onClick={this.onUnbindClick}
              />
            ) : null}
          </div>,
          <div key="bindingInput" className="ticl-hbox">
            <StringEditor
              value={bindingPath || ''}
              funcDesc={blankFuncDesc}
              desc={blankPropDesc}
              onChange={this.onBindChange}
            />
          </div>
        );
      }

      // need this temporary variable to work around a compiler issue that () get removed and ?? and || can't be used together
      const resolvedValueDefined = valueDefined ?? valueDenfinedOverride;
      if ((resolvedValueDefined || bindingPath) && this.can('set')) {
        menuItems.push(
          <Button key="clear" shape="round" onClick={this.onClear}>
            {t('Clear')}
          </Button>
        );
      }

      if ((isTemp ?? isTempOverride) && this.can('restoreSaved')) {
        menuItems.push(
          <Button key="restoreSaved" shape="round" onClick={this.onRestoreSaved}>
            {t('Restore Saved Value')}
          </Button>
        );
      }
    }
    if (group != null) {
      const groupIndex = getTailingNumber(name);
      if (groupIndex > -1) {
        if (this.can('insertGroupProp')) {
          menuItems.push(
            <Button key="insertIndex" shape="round" onClick={this.onInsertIndex}>
              {t('Insert at {{n}}', {n: groupIndex})}
            </Button>
          );
        }
        if (this.can('removeGroupProp')) {
          menuItems.push(
            <Button key="deleteIndex" shape="round" onClick={this.onDeleteIndex}>
              {t('Delete at {{n}}', {n: groupIndex})}
            </Button>
          );
        }
      }
    }

    if (this.can(display ? 'hideProps' : 'showProps')) {
      menuItems.push(
        <Checkbox key="showHide" onChange={this.onShowHide} checked={display}>
          {t('Pinned')}
        </Checkbox>
      );
    }
    if (isCustom) {
      if (this.can('removeCustomProp')) {
        menuItems.push(
          <Button key="removeFromCustom" shape="round" onClick={this.onRemoveCustom}>
            {t('Remove Property')}
          </Button>
        );
      }
      if (group != null && this.can('addCustomProp')) {
        menuItems.push(
          <SubMenuItem
            key="addCustomProp"
            popup={<AddCustomPropertyMenu conn={conn} onAddProperty={this.onAddCustomGroupChild} group={group} />}
          >
            {t('Add Child Property')}
          </SubMenuItem>
        );
      }
    }
    if (propDesc.commands) {
      const commands = Object.keys(propDesc.commands);
      if (commands.length) {
        commands.sort(smartStrCompare);
        const commandMenus: React.ReactElement[] = [];
        for (const command of commands) {
          if (!this.can('executeCommand', {command})) continue;
          commandMenus.push(
            <MenuItem key={`cmd-${command}`} value={command} onClick={this.onExeCommand}>
              <LocalizedPropCommand key={command} funcDesc={funcDesc} propBaseName={propDesc.name} command={command} />
            </MenuItem>
          );
        }

        if (commandMenus.length) {
          menuItems.push(
            <div key="divider" className="ticl-property-divider">
              {t('Execute Command')}
              <div className="ticl-h-line" />
            </div>
          );
          menuItems.push(...commandMenus);
        }

        // menuItems.push(
        //   <SubMenuItem key="propCommands" popup={<Menu>{commandMenus}</Menu>}>
        //     {t('Execute Command')}
        //   </SubMenuItem>
        // );
      }
    }
    return menuItems.length ? <Menu>{menuItems}</Menu> : null;
  }

  render(): any {
    const {children} = this.props;
    const {visible, modal} = this.state;
    const popup = visible ? this.getMenu() : null;
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
