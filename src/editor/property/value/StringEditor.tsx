import React from 'react';
import {Input} from 'antd';
import {StringEditorBase} from './StringEditorBase';
import {encodeDisplay} from '../../../core/util/Serialize';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext';
import {PropDesc} from '../../../core/block/Descriptor';

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
          autoSize={{minRows: 1, maxRows: 5}}
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
