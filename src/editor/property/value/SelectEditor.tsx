import React from 'react';
import {Select} from 'antd';
import {ValueEditorProps} from './ValueEditorBase';
import {LocalizedEnumOption} from '../../component/LocalizedLabel';

const {Option} = Select;

export class SelectEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (value: string | number) => {
    let {onChange, name} = this.props;
    onChange(value, name);
  };

  getOptions() {
    let {desc, name, funcDesc} = this.props;
    let {options} = desc;
    let optionNodes: React.ReactNode[] = [];
    if (Array.isArray(options)) {
      for (let opt of options) {
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
    let {onChange, name} = this.props;
    onChange(value, name);
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
