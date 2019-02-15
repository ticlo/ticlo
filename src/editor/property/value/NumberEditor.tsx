import * as React from "react";
import {InputNumber} from "antd";
import {PropDesc} from "../../../common/block/Descriptor";
import {ValueEditorProps} from "./ValueEditor";

export class NumberEditor extends React.PureComponent<ValueEditorProps, any> {

  // this is not a state bacause in commitChange() editorValue is changed but we don't want a re-render until prop change
  _pendingValue: string | number = NaN;


  commitChange(value: number) {
    let {desc} = this.props;
    if (desc.default === value) {
      value = undefined;
    }

    this._pendingValue = NaN;
    this.props.onChange(value);
  }

  onValueChange = (value: any) => {
    if (this._pendingTyping) {
      if (value === value) {
        // not allow NaN
        if (value !== this.props.value || this._pendingValue === this._pendingValue) {
          // when pending value already exists or server value is not the same
          this._pendingValue = value;
        }
      }
      this._pendingTyping = false;
      this.forceUpdate();
    } else {
      this.commitChange(value);
    }
  };

  checkAndCommit = () => {
    let pendingValue = this._pendingValue;
    if (pendingValue === pendingValue) {
      if (typeof pendingValue === 'string') {
        pendingValue = Number(pendingValue);
      }
      if (pendingValue === pendingValue) {
        this.commitChange(pendingValue);
      } else {
        this._pendingValue = NaN;
        this.forceUpdate();
      }
    }
  };

  _pendingTyping = false;
  onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key.length === 1) { // regular typing
      this._pendingTyping = true;
      return;
    }
    switch (e.key) {
      case 'Enter': {
        this._pendingTyping = false;
        this.checkAndCommit();
        return;
      }
      case 'Escape': {
        this._pendingTyping = false;
        if (this._pendingValue) {
          this._pendingValue = NaN;
          this._pendingTyping = false;
          this.forceUpdate();
        }
        return;
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        this._pendingTyping = false;
        return;
      }
      case 'Backspace':
      case 'Delete': {
        this._pendingTyping = true;
        return;
      }
    }
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    if (value === undefined && desc.default) {
      value = desc.default;
    }
    if (this._pendingValue === this._pendingValue) { // not NaN
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }
    return (
      <InputNumber size='small' placeholder={desc.placeholder} value={value}
                   disabled={onChange == null}
                   min={desc.min} max={desc.max} step={desc.step}
                   onChange={this.onValueChange} onBlur={this.checkAndCommit} onKeyDown={this.onKeyDown}/>
    );
  }
}
