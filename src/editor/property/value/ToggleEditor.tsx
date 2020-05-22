import React from 'react';
import {Switch} from 'antd';
import {ValueEditorProps} from './ValueEditorBase';
import {LocalizedEnumOption} from '../../component/LocalizedLabel';

export class ToggleEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (checked: boolean) => {
    let {desc, onChange} = this.props;
    let {options} = desc;
    if (options && options.length >= 2) {
      // convert string to boolean
      onChange(checked ? options[1] : options[0]);
    } else {
      onChange(checked);
    }
  };

  render() {
    let {desc, value, locked, onChange, funcDesc, name} = this.props;
    let {options} = desc;
    let checkedChildren: React.ReactNode;
    let unCheckedChildren: React.ReactNode;
    if (options && options.length >= 2) {
      // convert string to boolean
      unCheckedChildren = <LocalizedEnumOption desc={funcDesc} propName={name} option={options[0]} />;
      checkedChildren = <LocalizedEnumOption desc={funcDesc} propName={name} option={options[1]} />;
      if (typeof value === 'string' || typeof value === 'number') {
        value = value === options[1];
      }
    }
    return (
      <Switch
        checked={Boolean(value)}
        disabled={locked || onChange == null}
        unCheckedChildren={unCheckedChildren}
        checkedChildren={checkedChildren}
        onChange={this.onValueChange}
      />
    );
  }
}
