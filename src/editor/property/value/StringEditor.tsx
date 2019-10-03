import React from 'react';
import {Input} from 'antd';
import {StringEditorBase} from './StringEditorBase';
import {encodeDisplay} from '../../../core/util/Serialize';

const {TextArea} = Input;

export class StringEditor extends StringEditorBase {
  render() {
    let {desc, value, locked, onChange} = this.props;
    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }
    if (typeof value === 'object') {
      // encode object
      value = encodeDisplay(value);
    }
    return (
      <TextArea
        placeholder={desc.placeholder}
        value={value}
        disabled={onChange == null}
        autosize={{minRows: 1, maxRows: 5}}
        onChange={this.onInputChange}
        onBlur={this.onBlur}
        onKeyDown={this.onKeyDown}
      />
    );
  }
}
