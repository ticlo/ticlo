import React from 'react';
import {AutoComplete} from 'antd';
import {PropDesc} from '../../../core/block/Descriptor';
import {ValueEditorProps} from './ValueEditorBase';

export class ComboEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (value: string | number) => {
    let {onChange} = this.props;
    onChange(value);
  };

  getOptions() {
    let {options} = this.props.desc;
    let optionNodes: string[] = [];
    if (Array.isArray(options)) {
      for (let opt of options) {
        optionNodes.push(String(opt));
      }
    }
    return optionNodes;
  }

  render() {
    let {desc, value, locked, onChange} = this.props;
    let {options} = desc;
    return (
      <AutoComplete
        size="small"
        value={value}
        disabled={locked || onChange == null}
        onChange={this.onValueChange}
        dataSource={this.getOptions()}
      />
    );
  }
}
