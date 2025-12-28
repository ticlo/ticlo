import React from 'react';
import {AutoComplete} from 'antd';
import {PropDesc} from '@ticlo/core';
import {ValueEditorProps} from './ValueEditorBase.js';
import {LocalizedEnumOption} from '../../component/LocalizedLabel.js';

const {Option} = AutoComplete;

export class ComboEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (value: string | number) => {
    const {onChange, name} = this.props;
    onChange(value, name);
  };

  getOptions() {
    const {funcDesc, name, desc} = this.props;
    const {options} = desc;
    const optionNodes: React.ReactNode[] = [];
    if (Array.isArray(options)) {
      for (const opt of options) {
        const str = String(opt);
        optionNodes.push(
          <Option key={str} value={str}>
            <LocalizedEnumOption desc={funcDesc} propName={name} option={opt} />
          </Option>
        );
      }
    }
    return optionNodes;
  }
  render() {
    const {desc, value, locked, onChange} = this.props;
    const {options} = desc;
    return (
      <AutoComplete size="small" value={value} disabled={locked || onChange == null} onChange={this.onValueChange}>
        {this.getOptions()}
      </AutoComplete>
    );
  }
}
