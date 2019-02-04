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
    if (!Object.is(props.value, nextProps.value)) { // Object.is also covers NaN
      // only render when there is no pendingValue
      return Object.is(this._pendingValue, this._commitedValue);
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
      this._pendingValue = value;
      this._pendingTyping = false;
    } else {
      this.commitChange(value);
    }
  };

  onBlur = () => {
    if (!Object.is(this._pendingValue, this._commitedValue)) { // Object.is also covers NaN
      this.commitChange(this._pendingValue);
    }
  };

  _pendingTyping = false;
  onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      this._pendingTyping = false;
      if (!Object.is(this._pendingValue, this._commitedValue)) { // Object.is also covers NaN
        this.commitChange(this._pendingValue);
      }
    } else if (e.key === 'Esc') {
      this._pendingTyping = false;
      this._pendingValue = this._commitedValue;
    } else {
      this._pendingTyping = true;
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