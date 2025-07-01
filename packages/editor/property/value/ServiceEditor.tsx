import React, {ReactElement} from 'react';
import {Button, Input, Select} from 'antd';
import PlusIcon from '@ant-design/icons/PlusOutlined';
import EllipsisIcon from '@ant-design/icons/EllipsisOutlined';
import {ClientConn, FunctionDesc, getDefaultFuncData, getSubBlockFuncData, PropDesc} from '@ticlo/core/editor';
import {Popup} from '../../component/ClickPopup';
import {PropertyList} from '../PropertyList';

const {Option} = Select;

export interface Props {
  conn?: ClientConn;
  keys: string[];
  value: any;
  bindingPath: string;
  funcDesc: FunctionDesc;
  desc: PropDesc;
  locked?: boolean;
  onPathChange?: (path: string) => void;
}

interface State {
  opened?: boolean;
}

export class ServiceEditor extends React.PureComponent<Props, State> {
  state: State = {};

  onGlobalBlockSelect = (value: string) => {
    let {onPathChange} = this.props;
    onPathChange(`${value}.#output`);
  };

  onCreate = async () => {
    let {conn, desc, onPathChange} = this.props;
    let {create} = desc;
    let funcDesc = conn.watchDesc(create);
    if (funcDesc) {
      let createdBlock = await conn.addBlock(
        `#global.^${funcDesc.name}`,
        getSubBlockFuncData(getDefaultFuncData(funcDesc))
      );
      if (createdBlock && Object.hasOwn(createdBlock, 'name')) {
        onPathChange(`${createdBlock.name}.#output`);
        this.openPopup();
      }
    }
  };

  getPopup = () => {
    let {bindingPath, conn, keys, desc, locked, onPathChange} = this.props;
    if (!this.state.opened) {
      // work around of the pop caching issue
      return <div />;
    }
    let bindingParentPath = bindingPath.substring(0, bindingPath.lastIndexOf('.'));
    let sourceKeys: string[] = keys.map((key) => `${key}.${bindingParentPath}`);
    return (
      <PropertyList conn={conn} paths={sourceKeys} mode="minimal" style={{width: 300, minHeight: 160, padding: 16}} />
    );
  };

  openPopup = () => {
    this.setState({opened: true});
  };
  onPopupClose = (visible?: boolean) => {
    if (!visible) {
      this.setState({opened: false});
    }
  };

  render() {
    let {bindingPath, value, conn, desc, locked, onPathChange} = this.props;
    let {opened} = this.state;
    let {create} = desc;

    let globalNames = conn.findGlobalBlocks(desc.options as string[]);

    let optionNodes: React.ReactNode[] = [];
    for (let name of globalNames) {
      optionNodes.push(
        <Option key={name} value={name}>
          {name}
        </Option>
      );
    }

    let selectValue = bindingPath;
    if (typeof selectValue === 'string' && selectValue.endsWith('.#output')) {
      selectValue = selectValue.substring(0, selectValue.length - 8);
    }
    let button: React.ReactElement;
    if (bindingPath) {
      button = (
        <Popup popupVisible={opened} onPopupVisibleChange={this.onPopupClose} popup={this.getPopup}>
          <Button className="ticl-square-icon-btn" size="small" icon={<EllipsisIcon />} onClick={this.openPopup} />
        </Popup>
      );
    } else if (!locked && create) {
      button = <Button className="ticl-square-icon-btn" size="small" icon={<PlusIcon />} onClick={this.onCreate} />;
    }

    return (
      <div className="ticl-hbox ticl-service-editor">
        <Select
          size="small"
          value={selectValue}
          disabled={locked || onPathChange == null}
          onChange={this.onGlobalBlockSelect}
        >
          {optionNodes}
        </Select>
        {button}
      </div>
    );
  }
}
