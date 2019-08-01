import React, {ReactElement} from "react";
import {ClientConnection} from "../../../core/connect/ClientConnection";
import {getDefaultFuncData, PropDesc} from "../../../core/block/Descriptor";
import {arrayEqual} from "../../../core/util/Compare";
import {Button, Icon, Input, Select} from "antd";
import {Popup} from "../../component/ClickPopup";
import {TypeSelect} from "../../type-selector/TypeSelector";

const {Option} = Select;

export interface Props {
  conn?: ClientConnection;
  value: any;
  bindingPath: string;
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
    onPathChange(`${value}.output`);
  };

  onCreate = async () => {
    let {conn, desc, onPathChange} = this.props;
    let {create} = desc;
    let funcDesc = conn.watchDesc(create);
    if (funcDesc) {
      let createdBlock = await conn.createBlock(`#global.^${funcDesc.name}`, getDefaultFuncData(funcDesc), true);
      if (createdBlock && createdBlock.hasOwnProperty('name')) {
        onPathChange(`${createdBlock.name}.output`);
      }
    }
  };

  getPopup = () => {
    return <div />
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
      optionNodes.push(<Option key={name} value={name}>{name}</Option>);
    }

    let selectValue = bindingPath;
    if (typeof selectValue === 'string' && selectValue.endsWith('.output')) {
      selectValue = selectValue.substring(0, selectValue.length - 7);
    }

    let button: React.ReactElement;
    if (bindingPath) {
      button = (
        <Popup popupVisible={opened}
               onPopupVisibleChange={this.onPopupClose}
               popup={this.getPopup}>
          <Button size='small' shape="circle" icon="ellipsis" onClick={this.openPopup}/>
        </Popup>
      );
    } else if (!locked && create) {
      button = <Button size='small' shape="circle" icon="plus" onClick={this.onCreate}/>;
    }

    return (
      <div className='ticl-hbox ticl-service-editor'>
        <Select size='small' value={selectValue} disabled={locked || onPathChange == null}
                onChange={this.onGlobalBlockSelect}>
          {optionNodes}
        </Select>
        {button}
      </div>
    );
  }
}