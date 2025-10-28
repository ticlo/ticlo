import React from 'react';
import {Select as AntSelect} from 'antd';
import {ValueEditorProps} from './ValueEditorBase';
import {LocalizedEnumOption} from '../../component/LocalizedLabel';
import {Select, type SelectOption} from '../../component/Select';

const {Option} = AntSelect;
type SelectValue = string | number;

export class SelectEditor extends React.PureComponent<ValueEditorProps, any> {
  protected getOptionValues(): SelectValue[] {
    const {desc} = this.props;
    if (Array.isArray(desc.options)) {
      return desc.options as SelectValue[];
    }
    return [];
  }

  onValueChange = (value: SelectValue) => {
    const {onChange, name} = this.props;
    onChange(value, name);
  };

  render() {
    const {name, funcDesc, value, locked, onChange} = this.props;
    const optionValues = this.getOptionValues();
    const selectOptions: SelectOption<SelectValue>[] = optionValues.map((opt) => ({
      value: opt,
      label: <LocalizedEnumOption desc={funcDesc} propName={name} option={opt} />,
    }));

    return (
      <Select<SelectValue>
        value={value as SelectValue}
        options={selectOptions}
        disabled={locked || onChange == null}
        onChange={this.onValueChange}
      />
    );
  }
}

export class MultiSelectEditor extends SelectEditor {
  onValuesChange = (value: SelectValue[]) => {
    const {onChange, name} = this.props;
    onChange(value, name);
  };

  render() {
    const {name, funcDesc, value, locked, onChange, desc} = this.props;
    const optionValues = this.getOptionValues();
    const optionNodes = optionValues.map((opt) => (
      <Option key={String(opt)} value={opt}>
        <LocalizedEnumOption desc={funcDesc} propName={name} option={opt} />
      </Option>
    ));

    return (
      <AntSelect
        size="small"
        mode="multiple"
        value={value}
        disabled={locked || onChange == null}
        onChange={this.onValuesChange}
        placeholder={desc.placeholder}
      >
        {optionNodes}
      </AntSelect>
    );
  }
}
