import React from 'react';
import {ValueEditorProps} from './ValueEditorBase';
import {LocalizedEnumOption} from '../../component/LocalizedLabel';
import {ButtonRadioGroup, ButtonRadioOption} from '../../component/ButtonRadioGroup';

export class RadioButtonEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (nextValue?: string | number) => {
    let {onChange, name} = this.props;
    if (onChange) {
      onChange(nextValue, name);
    }
  };

  render() {
    let {desc, name, funcDesc, value, locked, onChange} = this.props;
    let {options} = desc;
    let optionList: ButtonRadioOption[] = [];
    if (Array.isArray(options)) {
      for (let opt of options) {
        if (typeof opt === 'string' || typeof opt === 'number') {
          optionList.push({
            value: opt,
            children: <LocalizedEnumOption desc={funcDesc} propName={name} option={opt} />,
          });
        }
      }
    }
    return (
      <ButtonRadioGroup
        options={optionList}
        value={value as string | number}
        disabled={locked || onChange == null}
        onChange={this.onValueChange}
      />
    );
  }
}
