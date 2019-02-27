import * as React from "react";
import {Button} from "antd";
import {ValueEditorProps} from "./ValueEditor";

// remove thousand separator
const formatNumberRegx = /[,\s]+/g;

const formulaNameRegx = /\b[a-zA-Z]\w+/g;

const MathDeg = (() => {
  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;

  let result: any = {};

  for (let key of Object.getOwnPropertyNames(Math)) {
    // move function from Math
    result[key] = (Math as any)[key];
    let lower = key.toLowerCase();
    if (lower !== key) {
      result[lower] = result[key];
    }
  }

  // use degree instead of rad
  for (let name of ['sin', 'cos', 'tan']) {
    result[`${name}Rad`] = result[name];
    let f: Function = result[name];
    result[name] = function (input: number) {
      return f(input * deg2rad);
    };
  }
  for (let name of ['asin', 'acos', 'atan', 'atan2']) {
    result[`${name}Rad`] = result[name];
    let f: Function = result[name];
    result[name] = function () {
      return f(...arguments) * rad2deg;
    };
  }
  return result;
})();

export class NumberEditor extends React.PureComponent<ValueEditorProps, any> {

  // this is not a state bacause in commitChange() editorValue is changed but we don't want a re-render until prop change
  _pendingValue: string = null;

  commitChange(value: string | number) {
    this._pendingValue = null;
    value = this.toNumber(value);
    if (value === value) {
      let {desc} = this.props;
      let {max, min, step} = desc;
      if (step) {
        value = Math.round(value / step) * step;
      }
      if (max !== null && value > max) {
        value = max;
      } else if (min !== null && value < min) {
        value = min;
      }
      if (value === this.props.value) {
        this.forceUpdate();
      }
      this.props.onChange(value);
    } else {
      this.forceUpdate();
    }
  }


  onValueChange = (e: React.SyntheticEvent) => {
    let value = (e.nativeEvent.target as HTMLInputElement).value;
    if (value !== this.props.value || this._pendingValue != null) {
      // when editorValue value already exists or server value is not the same
      this._pendingValue = value;
    }
  };

  onBlur = () => {
    if (this._pendingValue != null) {
      this.commitChange(this._pendingValue);
    }
  };

  evalFormula(str: string): number {
    try {
      let converted = str.replace(formulaNameRegx, (str: string) => {
        if (MathDeg.hasOwnProperty(str)) {
          return `(MathDeg.${str})`;
        }
        throw 1;
      });
      return Function('MathDeg', `"use strict";return (${converted})`)(MathDeg);
    } catch (e) {
      return NaN;
    }
  }

  onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    switch (e.key) {
      case 'Escape': {
        if (this._pendingValue != null) {
          this._pendingValue = null;
          this.forceUpdate();
        }
        return;
      }
      case 'Enter': {
        if (this._pendingValue != null) {
          if (e.shiftKey) {
            let formulaResult = this.evalFormula(this._pendingValue);
            if (formulaResult === formulaResult) {
              this.commitChange(formulaResult);
            } else {
              // invalid result
              e.preventDefault();
            }
          } else {
            this.commitChange(this._pendingValue);
          }
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
    if (value === undefined) {
      value = '';
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
