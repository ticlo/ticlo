import React from 'react';
import {Menu, Popup, SubMenuItem, MenuItem} from '../component/ClickPopup.js';
import {FunctionSelect} from '../function-selector/FunctionSelector.js';
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
import {LocalizedPropCommand, LocalizedPropertyName, t} from '../component/LocalizedLabel.js';
import {Button, Checkbox} from 'antd';
import {DeleteOutlined} from '@ant-design/icons';
import {StringEditor} from '../property/value/StringEditor.js';
import {AddCustomPropertyMenu} from '../property/AddCustomProperty.js';
import {ClientConn, ValueSubscriber} from '@ticlo/core/connect/ClientConn.js';
import {CheckboxChangeEvent} from 'antd';
import {ParameterInputDialog} from './ParameterInputDialog.js';
import {ExpandIcon} from '../component/Tree.js';
import {ValueUpdate} from '@ticlo/core/connect/ClientRequests.js';

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
    const {conn, paths, name, group} = this.props;
    const index = getTailingNumber(name);
    for (const path of paths) {
      conn.insertGroupProp(path, group, index);
    }
    this.closeMenu();
  };
  onDeleteIndex = () => {
    const {conn, paths, name, group} = this.props;
    const index = getTailingNumber(name);
    for (const path of paths) {
      conn.removeGroupProp(path, group, index);
    }
    this.closeMenu();
  };

  onClear = () => {
    const {conn, paths, name} = this.props;
    for (const path of paths) {
      conn.setValue(`${path}.${name}`, undefined);
    }
    this.closeMenu();
  };
  onRestoreSaved = () => {
    const {conn, paths, name} = this.props;
    for (const path of paths) {
      conn.restoreSaved(`${path}.${name}`);
    }
    this.closeMenu();
  };
  onShowHide = (e: CheckboxChangeEvent) => {
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
    const {conn, paths, name} = this.props;
    if (str === '') {
      str = undefined;
    }
    for (const key of paths) {
      conn.setBinding(`${key}.${name}`, str);
    }
  };
  onUnbindClick = (e: any) => {
    const {conn, paths, name} = this.props;
    for (const key of paths) {
      conn.setBinding(`${key}.${name}`, null, true);
    }
  };
  onRemoveCustom = () => {
    let {conn, paths, name, baseName, group} = this.props;
    const removeField = baseName != null ? baseName : name;
    if (group != null && name === `${group}[]`) {
      name = null;
    }
    for (const path of paths) {
      conn.removeCustomProp(path, removeField, group);
    }
    this.closeMenu();
  };
  onAddCustomGroupChild = (desc: PropDesc | PropGroupDesc) => {
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
    const {conn, paths, name, funcDesc, propDesc} = this.props;
    const commandDesc = propDesc.commands[command];
    if (commandDesc.parameters?.length) {
      const onConfirmCommandModal = (values: DataMap) => {
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
    },
    funcId: string,
    desc?: FunctionDesc,
    data?: any
  ) {
    const {conn, paths, name} = props;
    if (!desc) {
      desc = conn.watchDesc(funcId);
    }
    if (!data) {
      if (!desc) {
        Logger.error('unable to add sub block, missing id or desc or data', this);
        return;
      }
      data = getSubBlockFuncData(getDefaultFuncData(desc));
    }

    for (const path of paths) {
      conn.addBlock(`${path}.~${name}`, data);
    }
  }

  onAddSubBlock = (id: string, desc?: FunctionDesc, data?: any) => {
    const {onAddSubBlock} = this.props;
    this.setState({visible: false});
    onAddSubBlock?.(id, desc, data);
  };

  getMenu() {
    const {funcDesc, propDesc, bindingPath, group, name, conn, valueDefined, isCustom, isTemp, display} = this.props;
    const {valueDenfinedOverride, isTempOverride} = this.state;
    const menuItems: React.ReactElement[] = [];
    if (!propDesc.readonly) {
      if (!bindingPath) {
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
              />
              // </Menu.Item>
            }
          >
            {t('Add Sub Block')}
          </SubMenuItem>
        );
      }
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
        </div>
      );
      menuItems.push(
        <div key="bindingInput" className="ticl-hbox">
          <StringEditor
            value={bindingPath || ''}
            funcDesc={blankFuncDesc}
            desc={blankPropDesc}
            onChange={this.onBindChange}
          />
        </div>
      );

      // need this temporary variable to work around a compiler issue that () get removed and ?? and || can't be used together
      const resolvedValueDefined = valueDefined ?? valueDenfinedOverride;
      if (resolvedValueDefined || bindingPath) {
        menuItems.push(
          <Button key="clear" shape="round" onClick={this.onClear}>
            {t('Clear')}
          </Button>
        );
      }

      if (isTemp ?? isTempOverride) {
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
        menuItems.push(
          <Button key="insertIndex" shape="round" onClick={this.onInsertIndex}>
            {t('Insert at {{n}}', {n: groupIndex})}
          </Button>
        );
        menuItems.push(
          <Button key="deleteIndex" shape="round" onClick={this.onDeleteIndex}>
            {t('Delete at {{n}}', {n: groupIndex})}
          </Button>
        );
      }
    }

    menuItems.push(
      <Checkbox key="showHide" onChange={this.onShowHide} checked={display}>
        {t('Pinned')}
      </Checkbox>
    );
    if (isCustom) {
      menuItems.push(
        <Button key="removeFromCustom" shape="round" onClick={this.onRemoveCustom}>
          {t('Remove Property')}
        </Button>
      );
      if (group != null) {
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
    return <Menu>{menuItems}</Menu>;
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
