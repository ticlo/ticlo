import React from "react";
import {Input} from "antd";
import {PropDesc} from "../../../core/block/Descriptor";
import {ValueEditorProps} from "./ValueEditor";

const {Password} = Input;

export class PasswordEditor extends React.PureComponent<ValueEditorProps, any> {

  // this is not a state bacause in commitChange() editorValue is changed but we don't want a re-render until prop change
  _pendingValue: any = null;

  commitChange(value: string) {
    this._pendingValue = null;
    this.props.onChange(value);
  }

  onValueChange = (e: React.SyntheticEvent) => {
    let value = (e.nativeEvent.target as HTMLInputElement).value;
    if (value !== this.props.value || this._pendingValue != null) {
      // when editorValue value already exists or server value is not the same
      this._pendingValue = value;
      this.forceUpdate();
    }
  };

  onBlur = () => {
    if (this._pendingValue != null) {
      this.commitChange(this._pendingValue);
    }
  };

  onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (this._pendingValue != null) {
        this._pendingValue = null;
        this.forceUpdate();
      }
      return;
    } else if (e.key === 'Enter') {
      if (this._pendingValue != null) {
        this.commitChange(this._pendingValue);
      } else {
        this.commitChange(this.props.value);
      }
      return;
    }
    e.stopPropagation();
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }
    return (
      <Password size='small' placeholder={desc.placeholder} value={value} onChange={this.onValueChange}
                disabled={onChange == null}
                onBlur={this.onBlur} onKeyDown={this.onKeyDown}/>
    );
  }
}
