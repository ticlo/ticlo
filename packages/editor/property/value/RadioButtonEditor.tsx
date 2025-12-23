import React from 'react';
import {Radio} from 'antd';
import {ValueEditorProps} from './ValueEditorBase.js';
import {RadioChangeEvent} from 'antd';
import {LocalizedEnumOption} from '../../component/LocalizedLabel.js';

const RadioButton = Radio.Button;
const RadioGroup = Radio.Group;

export class RadioButtonEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (e: RadioChangeEvent) => {
    let {onChange, name} = this.props;
    onChange(e.target.value, name);
  };

  render() {
    let {desc, name, funcDesc, value, locked, onChange} = this.props;
    let {options} = desc;
    let optionNodes: React.ReactNode[] = [];
    if (Array.isArray(options)) {
      for (let opt of options) {
        optionNodes.push(
          <RadioButton key={String(opt)} value={opt}>
            <LocalizedEnumOption desc={funcDesc} propName={name} option={opt} />
          </RadioButton>
        );
      }
    }
    return (
      <RadioGroup
        size="small"
        buttonStyle="solid"
        value={value}
        disabled={locked || onChange == null}
        onChange={this.onValueChange}
      >
        {optionNodes}
      </RadioGroup>
    );
  }
}
