import React from 'react';
import {Menu, Popup, SubMenuItem} from '../component/ClickPopup';
import {FunctionSelect} from '../function-selector/FunctionSelector';
import {
  blankFuncDesc,
  blankPropDesc,
  FunctionDesc,
  getDefaultFuncData,
  getSubBlockFuncData,
  getTailingNumber,
  Logger,
  PropDesc,
  PropGroupDesc,
  stopPropagation,
} from '../../../src/core';
import {LocalizedPropertyName, t} from '../component/LocalizedLabel';
import {Button, Checkbox} from 'antd';
import DeleteIcon from '@ant-design/icons/DeleteOutlined';
import {StringEditor} from '../property/value/StringEditor';
import {AddCustomPropertyMenu} from '../property/AddCustomProperty';
import {ClientConn} from '../../core/connect/ClientConn';
import {CheckboxChangeEvent} from 'antd/lib/checkbox';

interface Props {
  children: React.ReactElement;

  propDesc: PropDesc;
  bindingPath: string;
  conn: ClientConn;
  group: string;
  value: any;
  isCustom: boolean;
  display: boolean;
  paths: string[];
  name: string;
  baseName: string;
  onAddSubBlock: () => void;
}

const PendingUpdate = <div />;
interface State {
  popupElement?: React.ReactElement | any;
  lastBindingPath: string;
}
export class PropertyPopup extends React.PureComponent<Props, State> {
  state: State = {lastBindingPath: null};

  closeMenu() {
    this.setState({popupElement: null});
  }

  onMenuVisibleChange = (flag: boolean) => {
    if (flag) {
      this.updateMenu();
    } else {
      // this.setState({popupElement: null});
    }
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
    PropertyPopup.addSubBlock(this.props, id, desc, data);
    this.setState({popupElement: null});
    onAddSubBlock?.();
  };

  updateMenu() {
    let {propDesc, bindingPath, group, conn, value, isCustom, display} = this.props;
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

      if (value !== undefined || bindingPath) {
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
    this.setState({popupElement: <Menu>{menuItems}</Menu>, lastBindingPath: bindingPath});
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>, snapshot?: any) {
    let {bindingPath} = this.props;
    let {lastBindingPath, popupElement} = this.state;
    if (popupElement && lastBindingPath !== bindingPath) {
      this.updateMenu();
    }
  }

  render(): any {
    let {children} = this.props;
    let {popupElement} = this.state;
    return (
      <Popup
        popup={popupElement}
        trigger={['contextMenu']}
        popupVisible={popupElement != null}
        onPopupVisibleChange={this.onMenuVisibleChange}
      >
        {children}
      </Popup>
    );
  }
}
