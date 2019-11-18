import React from 'react';
import {Select} from 'antd';
import {PropDesc} from '../../../core/block/Descriptor';
import {ValueEditorProps} from './ValueEditorBase';

const {Option} = Select;

export class SelectEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (value: string | number) => {
    let {onChange} = this.props;
    onChange(value);
  };

  getOptions() {
    let {options} = this.props.desc;
    let optionNodes: React.ReactNode[] = [];
    if (Array.isArray(options)) {
      for (let opt of options) {
        optionNodes.push(
          <Option key={String(opt)} value={opt}>
            {opt}
          </Option>
        );
      }
    }
    return optionNodes;
  }

  render() {
    let {desc, value, locked, onChange} = this.props;
    let optionNodes = this.getOptions();
    return (
      <Select size="small" value={value} disabled={locked || onChange == null} onChange={this.onValueChange}>
        {optionNodes}
      </Select>
    );
  }
}

export class MultiSelectEditor extends SelectEditor {
  onValuesChange = (value: string | number[]) => {
    let {onChange} = this.props;
    onChange(value);
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let optionNodes = this.getOptions();
    return (
      <Select
        size="small"
        mode="multiple"
        value={value}
        disabled={locked || onChange == null}
        onChange={this.onValuesChange}
      >
        {optionNodes}
      </Select>
    );
  }
}
