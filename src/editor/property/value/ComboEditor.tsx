import React from 'react';
import {AutoComplete} from 'antd';
import {PropDesc} from '@ticlo/core/editor';
import {ValueEditorProps} from './ValueEditorBase';
import {LocalizedEnumOption} from '../../component/LocalizedLabel';

const {Option} = AutoComplete;

export class ComboEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (value: string | number) => {
    let {onChange, name} = this.props;
    onChange(value, name);
  };

  getOptions() {
    let {funcDesc, name, desc} = this.props;
    let {options} = desc;
    let optionNodes: React.ReactNode[] = [];
    if (Array.isArray(options)) {
      for (let opt of options) {
        let str = String(opt);
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
    let {desc, value, locked, onChange} = this.props;
    let {options} = desc;
    return (
      <AutoComplete size="small" value={value} disabled={locked || onChange == null} onChange={this.onValueChange}>
        {this.getOptions()}
      </AutoComplete>
    );
  }
}
