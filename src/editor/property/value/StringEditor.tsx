import React from 'react';
import {Input} from 'antd';
import {StringEditorBase} from './StringEditorBase';
import {encodeDisplay} from '../../../../src/core/editor';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext';

const {TextArea} = Input;

export class StringEditor extends StringEditorBase {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  popup = () => {
    let {keys, name, desc, value, locked} = this.props;
    this.context.editProperty(
      keys.map((key) => `${key}.${name}`),
      desc,
      value,
      null,
      locked
    );
  };

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
      <>
        <TextArea
          placeholder={desc.placeholder}
          value={value}
          disabled={onChange == null}
          rows={value ? null : 1}
          autoSize={value ? {minRows: 1, maxRows: 5} : null}
          onChange={this.onInputChange}
          onBlur={this.onBlur}
          onKeyDown={this.onKeyDown}
        />
        {this.context?.editProperty ? (
          <div className="ticl-expand-button" title={'Edit'} onClick={this.popup}>
            <div className="ticl-expand-icon-11" />
          </div>
        ) : null}
      </>
    );
  }
}
