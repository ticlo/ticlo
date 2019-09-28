import React from 'react';
import {Switch} from 'antd';
import {ValueEditorProps} from './ValueEditorBase';

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
    let {desc, value, locked, onChange} = this.props;
    let {options} = desc;
    let checkedChildren: string;
    let unCheckedChildren: string;
    if (options && options.length >= 2) {
      // convert string to boolean
      unCheckedChildren = String(options[0]);
      checkedChildren = String(options[1]);
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
