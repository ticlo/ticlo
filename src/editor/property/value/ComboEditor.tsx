import React from 'react';
import {AutoComplete} from 'antd';
import {PropDesc} from '../../../../src/core/editor';
import {ValueEditorProps} from './ValueEditorBase';

const {Option} = AutoComplete;

export class ComboEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (value: string | number) => {
    let {onChange} = this.props;
    onChange(value);
  };

  getOptions() {
    let {options} = this.props.desc;
    let optionNodes: React.ReactNode[] = [];
    if (Array.isArray(options)) {
      for (let opt of options) {
        let str = String(opt);
        optionNodes.push(
          <Option key={str} value={str}>
            {str}
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
