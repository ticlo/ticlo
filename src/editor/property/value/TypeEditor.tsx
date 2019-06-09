import React from "react";
import {Icon, Input} from "antd";
import {FunctionDesc, PropDesc} from "../../../core/block/Descriptor";
import {ValueEditorProps} from "./ValueEditor";
import {TIcon} from "../../icon/Icon";
import {DragDropDiv} from "rc-dock";
import {StringEditorBase} from "./StringEditorBase";
import Trigger from "rc-trigger";
import {SketchPicker} from "react-color";
import {TypeSelect} from "../../type-selector/TypeSelector";
import {addRecentType} from "../../type-selector/TypeList";

interface State {
  funcDesc: FunctionDesc;
  opened: boolean;
}

export class TypeEditor extends StringEditorBase {

  state: State = {funcDesc: null, opened: false};

  commitChange(value: string) {
    super.commitChange(value);
    if (value) {
      addRecentType(value);
    }
  }

  openPopup = () => {
    this.setState({opened: true});
  };
  onPopupClose = (visible?: boolean) => {
    if (!visible) {
      this.setState({opened: false});
    }
  };

  onTypeClick = (name: string) => {
    this.commitChange(name);
    this.setState({opened: false});
  };

  render() {
    let {desc, value, locked, onChange, conn} = this.props;
    let {funcDesc, opened} = this.state;

    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }

    let iconstr = funcDesc ? funcDesc.icon : null;
    return (
      <DragDropDiv className='ticl-hbox'>
        <TIcon icon={iconstr}/>
        <Trigger action={['click']}
                 popupVisible={opened}
                 onPopupVisibleChange={this.onPopupClose}
                 popupAlign={{
                   points: ['tl', 'tl'],
                   offset: [0, 0],
                   overflow: {adjustX: true, adjustY: true}
                 }}
                 stretch='width'
                 prefixCls='ant-dropdown'
                 popup={
                   <TypeSelect conn={conn} onTypeClick={this.onTypeClick} onClose={this.onPopupClose}/>
                 }>
          <Input value={value} disabled={onChange == null} size='small'
                 onChange={this.onInputChange} onBlur={this.onBlur} onKeyDown={this.onKeyDown}
                 suffix={

                   <Icon type="down" style={{color: 'rgba(0,0,0,.45)'}} onClick={this.openPopup}/>

                 }/>
        </Trigger>
      </DragDropDiv>
    );
  }
}
