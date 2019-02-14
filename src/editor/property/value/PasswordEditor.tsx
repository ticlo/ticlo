import * as React from "react";
import {Input} from "antd";
import {PropDesc} from "../../../common/block/Descriptor";

const {Password} = Input;

interface Props {
  value: any;
  desc: PropDesc;
  onChange: (value: any) => void;
}

export class PasswordEditor extends React.PureComponent<Props, any> {

  // this is not a state bacause in commitChange() editorValue is changed but we don't want a re-render until prop change
  _pendingValue: any = null;

  commitChange(value: string) {
    this._pendingValue = null;
    this.props.onChange(value);
  }

  onValueChange = (e: React.SyntheticEvent) => {
    let value = (e.nativeEvent.target as HTMLInputElement).value;
    if (this._pendingTyping) {
      if (value !== this.props.value || this._pendingValue != null) {
        // when editorValue value already exists or server value is not the same
        this._pendingValue = value;
      }
      this._pendingTyping = false;
      this.forceUpdate();
    } else {
      this.commitChange(value);
    }
  };

  onBlur = () => {
    if (this._pendingValue != null) {
      this.commitChange(this._pendingValue);
    }
  };

  _pendingTyping = false;
  onKeyDown = (e: React.KeyboardEvent) => {
    console.log(e.nativeEvent);
    if (e.key === 'Escape') {
      this._pendingTyping = false;
      if (this._pendingValue != null) {
        this._pendingValue = null;
        this.forceUpdate();
      }
      return;
    } else if (e.key === 'Enter') {
      this._pendingTyping = false;
      if (this._pendingValue != null) {
        this.commitChange(this._pendingValue);
      }
      return;
    }
    this._pendingTyping = true;
    e.stopPropagation();
  };

  render() {
    let {desc, value, onChange} = this.props;
    if (this._pendingValue != null) {
      value = this._pendingValue;
    }
    return (
      <Password size='small' placeholder={desc.placeholder} value={value} onChange={this.onValueChange}
                disabled={onChange == null}
                onBlur={this.onBlur} onKeyDown={this.onKeyDown}/>
    );
  }
}