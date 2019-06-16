import React from "react";
import {Icon, Input} from "antd";
import {FunctionDesc, getFuncStyleFromDesc, PropDesc} from "../../../core/block/Descriptor";
import {ValueEditorProps} from "./ValueEditor";
import {TIcon} from "../../icon/Icon";
import {DragDropDiv} from "rc-dock";
import {StringEditorBase} from "./StringEditorBase";
import Trigger from "rc-trigger";
import {SketchPicker} from "react-color";
import {TypeSelect} from "../../type-selector/TypeSelector";
import {addRecentType} from "../../type-selector/TypeList";
import {onDragBlockOver, onDropBlock} from "../../block/DragDropBlock";
import {DragState} from "rc-dock";

interface State {
  opened: boolean;
}

export class TypeEditor extends StringEditorBase {

  state: State = {opened: false};

  commitChange(value: string) {
    super.commitChange(value);
    if (this.props.conn.watchDesc(value)) {
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

  onDragOver = (e: DragState) => {
    let {conn} = this.props;
    let blockData = DragState.getData('block', conn);

    if (blockData && blockData.hasOwnProperty('#is')) {
      e.accept('');
    }
  };

  onDrop = (e: DragState) => {
    let {conn} = this.props;
    let blockData = DragState.getData('block', conn);

    if (blockData && blockData.hasOwnProperty('#is')) {
      this.commitChange(blockData['#is']);
    }
  };


  render() {
    let {desc, value, locked, onChange, conn} = this.props;
    let {opened} = this.state;

    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }

    let iconName: string;
    let iconStyle = 'tico-prn';
    let funcDesc = conn.watchDesc(value);
    if (funcDesc) {
      iconName = funcDesc.icon;
      iconStyle = getFuncStyleFromDesc(funcDesc, 'tico-pr') || 'tico-prn';
    }
    return (
      <DragDropDiv className='ticl-type-editor ticl-hbox' onDragOverT={this.onDragOver} onDropT={this.onDrop}>
        <TIcon icon={iconName} style={iconStyle}/>
        <Trigger action={['click']}
                 popupVisible={opened}
                 onPopupVisibleChange={this.onPopupClose}
                 popupAlign={{
                   points: ['bl', 'tl'],
                   offset: [0, -3],
                   overflow: {adjustX: true, adjustY: true}
                 }}
                 prefixCls='ant-dropdown'
                 popup={
                   <TypeSelect conn={conn} onTypeClick={this.onTypeClick}/>
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
