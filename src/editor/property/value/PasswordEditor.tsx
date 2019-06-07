import React from "react";
import {Input} from "antd";
import {StringEditorBase} from "./StringEditorBase";

const {Password} = Input;

export class PasswordEditor extends StringEditorBase {
  render() {
    let {desc, value, locked, onChange} = this.props;
    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }
    return (
      <Password size='small' placeholder={desc.placeholder} value={value} onChange={this.onInputChange}
                disabled={onChange == null}
                onBlur={this.onBlur} onKeyDown={this.onKeyDown}/>
    );
  }
}
