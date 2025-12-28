import React from 'react';
import {Select} from 'antd';
import {ValueEditorProps} from './ValueEditorBase.js';
import {LocalizedEnumOption} from '../../component/LocalizedLabel.js';

const {Option} = Select;

export class SelectEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (value: string | number) => {
    const {onChange, name} = this.props;
    onChange(value, name);
  };

  getOptions() {
    const {desc, name, funcDesc} = this.props;
    const {options} = desc;
    const optionNodes: React.ReactNode[] = [];
    if (Array.isArray(options)) {
      for (const opt of options) {
        optionNodes.push(
          <Option key={String(opt)} value={opt}>
            <LocalizedEnumOption desc={funcDesc} propName={name} option={opt} />
          </Option>
        );
      }
    }
    return optionNodes;
  }

  render() {
    const {desc, value, locked, onChange} = this.props;
    const optionNodes = this.getOptions();
    return (
      <Select size="small" value={value} disabled={locked || onChange == null} onChange={this.onValueChange}>
        {optionNodes}
      </Select>
    );
  }
}

export class MultiSelectEditor extends SelectEditor {
  onValuesChange = (value: string | number[]) => {
    const {onChange, name} = this.props;
    onChange(value, name);
  };

  render() {
    const {desc, value, locked, onChange} = this.props;
    const optionNodes = this.getOptions();
    return (
      <Select
        size="small"
        mode="multiple"
        value={value}
        disabled={locked || onChange == null}
        onChange={this.onValuesChange}
        placeholder={desc.placeholder}
      >
        {optionNodes}
      </Select>
    );
  }
}
