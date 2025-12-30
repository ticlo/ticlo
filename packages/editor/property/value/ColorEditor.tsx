import React from 'react';
import {ColorPicker} from 'antd';
import {AggregationColor} from 'antd/es/color-picker/color.js';
import {ValueEditorProps} from './ValueEditorBase.js';
import tinycolor from 'tinycolor2';

function colorToHex(color: AggregationColor) {
  return color.toHexString();
}
export class ColorEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (value: AggregationColor) => {
    const {onChange, name} = this.props;
    onChange(colorToHex(value), name);
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    const {disableAlpha} = desc;

    const disabled = locked || onChange == null;
    if (typeof value !== 'string') {
      value = '';
    }

    return (
      <ColorPicker
        size="small"
        value={value}
        disabled={disabled}
        disabledAlpha={disableAlpha}
        onChange={this.onValueChange}
        showText={colorToHex}
      />
    );
  }
}
