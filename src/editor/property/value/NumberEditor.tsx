import * as React from "react";
import {InputNumber} from "antd";
import {PropDesc} from "../../../common/block/Descriptor";

interface Props {
  value: any;
  desc: PropDesc;
  onChange: (value: any) => void;
}

interface InputNumberRef extends React.Component<any, any> {
  inputNumberRef: React.Component<any, any>;
}

export class NumberEditor extends React.Component<Props, any> {

  _serverValue: number;
  _pendingValue: number = NaN;

  _inputNumberRef: InputNumberRef;

  getInputNumber = (ref: any) => {
    this._inputNumberRef = ref;
  };

  constructor(props: Props) {
    super(props);
    this._serverValue = props.value;
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
      this._serverValue = nextProps.value;
      // only render when there is no pendingValue (pending is NaN)
      if (this._pendingValue !== this._pendingValue) {
        return true;
      }
    }
    return false;
  }

  commitChange(value: number) {
    this._pendingValue = NaN;
    this._serverValue = value;
    this.props.onChange(value);
  }

  onValueChange = (value: any) => {
    if (this._pendingTyping) {
      if (value === value) {
        // not allow NaN
        if (value !== this._serverValue || this._pendingValue === this._pendingValue) {
          // when pending value already exists or server value is not the same
          this._pendingValue = value;
        }
      }
      this._pendingTyping = false;
    } else {
      this.commitChange(value);
    }
  };

  // onBlur = () => {
  //   if (this._pendingValue === this._pendingValue) { // not NaN
  //     this.commitChange(this._pendingValue);
  //   }
  // };

  _pendingTyping = false;
  onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key.length === 1) { // regular typing
      this._pendingTyping = true;
      return;
    }
    switch (e.key) {
      case 'Enter': {
        this._pendingTyping = false;
        if (this._pendingValue === this._pendingValue) { // not NaN
          this.commitChange(this._pendingValue);
        }
        return;
      }
      case 'Escape': {
        if (this._pendingValue) {
          this._pendingValue = NaN;
          this._pendingTyping = false;
          this._inputNumberRef.inputNumberRef.setState({inputValue: this._serverValue});
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
    let {desc, value, onChange} = this.props;
    return (
      <InputNumber ref={this.getInputNumber} size='small' placeholder={desc.placeholder} value={value}
                   disabled={onChange == null}
                   min={desc.min} max={desc.max} step={desc.step}
                   onChange={this.onValueChange} onKeyDown={this.onKeyDown}/>
    );
  }
}