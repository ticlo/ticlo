import * as React from "react";
import {Button} from "antd";
import {ValueEditorProps} from "./ValueEditor";

// remove thousand separator
const formatNumberRegx = /,/g

export class NumberEditor extends React.PureComponent<ValueEditorProps, any> {

  // this is not a state bacause in commitChange() editorValue is changed but we don't want a re-render until prop change
  _pendingValue: any = null;

  commitChange(value: string | number) {
    let {desc} = this.props;
    let {max, min, step} = desc;
    this._pendingValue = null;
    value = this.toNumber(value);
    if (value === value) {
      if (step) {
        value = Math.round(value / step) * step;
      }
      if (max !== null && value > max) {
        value = max;
      } else if (min !== null && value < min) {
        value = min;
      }
      if (value === desc.default) {
        this.props.onChange(undefined);
      } else {
        this.props.onChange(value);
      }
    } else {
      this.forceUpdate();
    }
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
    e.stopPropagation();
    switch (e.key) {
      case 'Escape': {
        this._pendingTyping = false;
        if (this._pendingValue != null) {
          this._pendingValue = null;
          this.forceUpdate();
        }
        return;
      }
      case 'Enter': {
        this._pendingTyping = false;
        if (this._pendingValue != null) {
          this.commitChange(this._pendingValue);
        } else {
          this.commitChange(this.props.value);
        }
        return;
      }
      case 'ArrowUp': {
        this.onPlusClick(e);
        e.preventDefault();
        return;
      }
      case 'ArrowDown': {
        this.onMinusClick(e);
        e.preventDefault();
        return;
      }
    }
    this._pendingTyping = true;
  };

  onMinusClick = (e: React.KeyboardEvent | React.MouseEvent) => {
    let {desc} = this.props;
    let value = this.currentValue();
    if (value === value) {
      let step = desc.step;
      if (!(step >= 0)) {
        step = 1;
      }
      if (e.shiftKey) {
        step *= 10;
      }
      this.commitChange(value - step);
    }
  };
  onPlusClick = (e: any) => {
    let {desc} = this.props;
    let value = this.currentValue();
    if (value === value) {

      let step = desc.step;
      if (!(step >= 0)) {
        step = 1;
      }
      if (e.shiftKey) {
        step *= 10;
      }
      this.commitChange(value + step);
    }
  };

  currentValue(): number {
    let {value, desc} = this.props;
    if (this._pendingValue != null) {
      value = this._pendingValue;
    }
    if (value === undefined) {
      if (typeof desc.default === 'number') {
        return desc.default;
      }
      return 0;
    }
    return this.toNumber(value);
  }

  toNumber(value: string | number): number {
    if (typeof value === 'number') {
      return value;
    }
    return Number(value.replace(formatNumberRegx, ''));
  }


  render() {
    let {desc, value, locked, onChange} = this.props;
    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }
    if (value === undefined && typeof desc.default === 'number') {
      value = desc.default;
    }

    let disabled = onChange == null;
    return (
      <div className={`ticl-number-input${disabled ? ' ticl-number-input-disabled' : ''}`}>
        <Button size='small' icon='minus' onClick={this.onMinusClick} disabled={disabled}/>
        <input className='ant-input ant-input-sm' type='text' placeholder={desc.placeholder}
               value={value}
               onChange={this.onValueChange} disabled={disabled}
               onBlur={this.onBlur} onKeyDown={this.onKeyDown}/>
        <Button size='small' icon='plus' onClick={this.onPlusClick} disabled={disabled}/>
      </div>

    );
  }
}
