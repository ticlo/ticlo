import React from "react";
import {Input} from "antd";
import {FunctionDesc, PropDesc} from "../../../core/block/Descriptor";
import {ValueEditorProps} from "./ValueEditor";
import {TIcon} from "../../icon/Icon";
import {DragDropDiv} from "rc-dock/lib";
import {StringEditorBase} from "./StringEditorBase";

interface State {
  funcDesc: FunctionDesc;
}

export class TypeEditor extends StringEditorBase {

  state: State = {funcDesc: null};


  render() {
    let {desc, value, locked, onChange} = this.props;
    let {funcDesc} = this.state;

    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }

    let iconstr = funcDesc ? funcDesc.icon : null;
    return (
      <div className='ticl-hbox'>
        <TIcon icon={iconstr}/>
        <Input value={value} disabled={onChange == null}
               onChange={this.onInputChange} onBlur={this.onBlur} onKeyDown={this.onKeyDown}/>
      </div>
    );
  }
}
