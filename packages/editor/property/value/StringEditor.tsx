import React from 'react';
import {Input} from 'antd';
import {StringEditorBase} from './StringEditorBase.ts';
import {encodeDisplay} from '@ticlo/core';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext.ts';

const {TextArea} = Input;

export class StringEditor extends StringEditorBase {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  popup = () => {
    const {keys, name, desc, value, inline, onEditValue} = this.props;
    if (inline) {
      onEditValue?.(desc);
      return;
    }
    this.context.editProperty(
      keys.map((key) => `${key}.${name}`),
      desc,
      value,
      null,
      desc.readonly
    );
  };

  render() {
    const {desc, locked, inline, onEditValue} = this.props;
    let {value, onChange} = this.props;
    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }
    if (typeof value === 'object') {
      // encode object
      value = encodeDisplay(value);
    }
    const multiLine = typeof value === 'string' && value.length > 8;
    if (inline) {
      const hasNewline = typeof value === 'string' && /[\r\n]/.test(value);
      return (
        <>
          <Input
            size="small"
            placeholder={desc.placeholder}
            value={hasNewline ? value.split(/[\r\n]/, 1)[0] + '…' : value}
            readOnly={hasNewline}
            disabled={onChange == null}
            onChange={this.onInputChange}
            onBlur={this.onBlur}
            onKeyDown={hasNewline ? undefined : this.onKeyDown}
          />
          {onEditValue ? (
            <div className="ticl-e-expand-button" title="Edit" onClick={this.popup}>
              <div className="ticl-e-expand-icon-11" />
            </div>
          ) : null}
        </>
      );
    }
    return (
      <>
        <TextArea
          placeholder={desc.placeholder}
          value={value}
          disabled={onChange == null}
          rows={multiLine ? null : 1}
          autoSize={multiLine ? {minRows: 1, maxRows: 5} : null}
          onChange={this.onInputChange}
          onBlur={this.onBlur}
          onKeyDown={this.onKeyDown}
        />
        {this.context?.editProperty ? (
          <div className="ticl-e-expand-button" title={'Edit'} onClick={this.popup}>
            <div className="ticl-e-expand-icon-11" />
          </div>
        ) : null}
      </>
    );
  }
}
