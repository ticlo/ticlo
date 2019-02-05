import * as React from "react";
import {InputNumber} from "antd";
import {PropDesc} from "../../../common/block/Descriptor";

interface Props {
  value: any;
  desc: PropDesc;
  onChange: (value: any) => void;
}

export class NumberEditor extends React.Component<Props, any> {

  _commitedValue: number;
  _pendingValue: number;

  constructor(props: Props) {
    super(props);
    this._commitedValue = props.value;
    this._pendingValue = props.value;
  }

  shouldComponentUpdate(nextProps: Readonly<Props>, nextState: Readonly<any>, nextContext: any) {
    let props = this.props;
    if (props.desc !== nextProps.desc) {
      return true;
    }
    if (props.onChange !== nextProps.onChange) {
      return true;
    }
    if (props.value !== nextProps.value) {
      // only render when there is no pendingValue
      if (this._pendingValue === this._commitedValue) {
        this._pendingValue = props.value;
        this._commitedValue = props.value;
        return true;
      }
    }
    return false;
  }

  commitChange(value: number) {
    this._pendingValue = value;
    this._commitedValue = value;
    this.props.onChange(value);
  }

  onValueChange = (value: any) => {
    if (this._pendingTyping) {
      if (value === value) {
        // not allow NaN
        this._pendingValue = value;
      }
      this._pendingTyping = false;
    } else {
      this.commitChange(value);
    }
  };

  onBlur = () => {
    if (this._pendingValue !== this._commitedValue) {
      this.commitChange(this._pendingValue);
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
        if (this._pendingValue !== this._commitedValue) { // Object.is also covers NaN
          this.commitChange(this._pendingValue);
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
    let {desc, value} = this.props;
    return (
      <InputNumber size='small' placeholder={desc.placeholder} value={value}
                   min={desc.min} max={desc.max} step={desc.step}
                   onChange={this.onValueChange} onBlur={this.onBlur} onKeyDown={this.onKeyDown}/>
    );
  }
}