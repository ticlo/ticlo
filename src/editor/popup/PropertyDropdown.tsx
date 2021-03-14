import React from 'react';
import {Menu, Popup, SubMenuItem} from '../component/ClickPopup';
import {FunctionSelect} from '../function-selector/FunctionSelector';
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
} from '../../../src/core';
import {LocalizedPropCommand, LocalizedPropertyName, t} from '../component/LocalizedLabel';
import {Button, Checkbox} from 'antd';
import DeleteIcon from '@ant-design/icons/DeleteOutlined';
import {StringEditor} from '../property/value/StringEditor';
import {AddCustomPropertyMenu} from '../property/AddCustomProperty';
import {ClientConn, ValueSubscriber} from '../../core/connect/ClientConn';
import {CheckboxChangeEvent} from 'antd/lib/checkbox';
import {ParameterInputDialog} from './ParameterInputDialog';
import {ExpandIcon} from '../component/Tree';
import {ValueUpdate} from '../../core/connect/ClientRequests';

interface Props {
  children: React.ReactElement;
  funcDesc: FunctionDesc;
  propDesc: PropDesc;
  bindingPath: string;
  conn: ClientConn;
  group?: string;
  valueDefined?: boolean;
  isCustom?: boolean;
  // whether property is shown in block view
  display: boolean;
  paths: string[];
  name: string;
  baseName?: string;
  onAddSubBlock: () => void;
}

const PendingUpdate = <div />;
interface State {
  visible: boolean;
  valueDenfinedOverride?: boolean;
  modal?: React.ReactElement;
}
export class PropertyDropdown extends React.PureComponent<Props, State> {
  state: State = {visible: false};

  subscriber = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let {value} = response.cache;
      this.setState({valueDenfinedOverride: value !== undefined});
    },
  });

  componentDidMount() {
    let {conn, valueDefined, paths, name} = this.props;
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
    let {conn, paths, name, group} = this.props;
    let index = getTailingNumber(name);
    for (let path of paths) {
      conn.insertGroupProp(path, group, index);
    }
    this.closeMenu();
  };
  onDeleteIndex = () => {
    let {conn, paths, name, group} = this.props;
    let index = getTailingNumber(name);
    for (let path of paths) {
      conn.removeGroupProp(path, group, index);
    }
    this.closeMenu();
  };

  onClear = () => {
    let {conn, paths, name} = this.props;
    for (let path of paths) {
      conn.setValue(`${path}.${name}`, undefined);
    }
    this.closeMenu();
  };
  onShowHide = (e: CheckboxChangeEvent) => {
    let {conn, paths, name} = this.props;
    for (let path of paths) {
      if (e.target.checked) {
        conn.showProps(path, [name]);
      } else {
        conn.hideProps(path, [name]);
      }
    }
  };
  onBindChange = (str: string) => {
    let {conn, paths, name} = this.props;
    if (str === '') {
      str = undefined;
    }
    for (let key of paths) {
      conn.setBinding(`${key}.${name}`, str);
    }
  };
  onUnbindClick = (e: any) => {
    let {conn, paths, name} = this.props;
    for (let key of paths) {
      conn.setBinding(`${key}.${name}`, null, true);
    }
  };
  onRemoveCustom = () => {
    let {conn, paths, name, baseName, group} = this.props;
    let removeField = baseName != null ? baseName : name;
    if (group != null && name === `${group}[]`) {
      name = null;
    }
    for (let path of paths) {
      conn.removeCustomProp(path, removeField, group);
    }
    this.closeMenu();
  };
  onAddCustomGroupChild = (desc: PropDesc | PropGroupDesc) => {
    let {conn, group, paths} = this.props;
    for (let path of paths) {
      conn.addCustomProp(path, desc, group);
    }
    this.closeMenu();
  };
  onCloseCommandModal = () => {
    this.setState({modal: null});
  };

  onExeCommand(command: string) {
    let {conn, paths, name, funcDesc, propDesc} = this.props;
    let commandDesc = propDesc.commands[command];
    if (commandDesc.parameters?.length) {
      let onConfirmCommandModal = (values: DataMap) => {
        for (let path of paths) {
          conn.executeCommand(path, command, {...values, property: name});
        }
        this.onCloseCommandModal();
      };
      let modal = (
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
      for (let path of paths) {
        conn.executeCommand(path, command, {property: name});
      }
    }
    this.closeMenu();
  }

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
    let {conn, paths, name} = props;
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

    for (let path of paths) {
      conn.addBlock(`${path}.~${name}`, data);
    }
  }

  onAddSubBlock = (id: string, desc?: FunctionDesc, data?: any) => {
    let {onAddSubBlock} = this.props;
    PropertyDropdown.addSubBlock(this.props, id, desc, data);
    this.setState({visible: false});
    onAddSubBlock?.();
  };

  getMenu() {
    let {funcDesc, propDesc, bindingPath, group, name, conn, valueDefined, isCustom, display} = this.props;
    let {valueDenfinedOverride} = this.state;
    let menuItems: React.ReactElement[] = [];
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
              icon={<DeleteIcon />}
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
      let resolvedValueDefined = valueDefined ?? valueDenfinedOverride;
      if (resolvedValueDefined || bindingPath) {
        menuItems.push(
          <Button key="clear" shape="round" onClick={this.onClear}>
            {t('Clear')}
          </Button>
        );
      }
    }
    if (group != null) {
      let groupIndex = getTailingNumber(name);
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
      let commands = Object.keys(propDesc.commands);
      commands.sort(smartStrCompare);
      if (commands.length) {
        let commandMenus: React.ReactElement[] = [];
        for (let command of commands) {
          commandMenus.push(
            // tslint:disable-next-line:jsx-no-lambda
            <span key={command} onClick={() => this.onExeCommand(command)}>
              <LocalizedPropCommand key={command} funcDesc={funcDesc} propBaseName={propDesc.name} command={command} />
            </span>
          );
        }

        if (commandMenus.length) {
          menuItems.push(
            <div className="ticl-property-divider">
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
