import React, {CSSProperties} from 'react';
import {ColorResult, SketchPicker} from 'react-color';
import {ValueEditorProps} from './ValueEditorBase';
import tinycolor from 'tinycolor2';
import {Popup} from '../../component/ClickPopup';

export class ColorEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (value: ColorResult) => {
    let {onChange} = this.props;
    let color = tinycolor(value.rgb);
    if (color.getAlpha() === 1) {
      onChange(value.hex);
    } else {
      onChange(color.toHex8String());
    }
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let {disableAlpha} = desc;

    let disabled = locked || onChange == null;
    if (typeof value !== 'string') {
      value = '';
    }
    let editorStyle: React.CSSProperties;
    if (disabled) {
      editorStyle = {cursor: 'not-allowed'};
    }

    return (
      <Popup
        trigger={disabled ? [] : ['click']}
        popup={
          <SketchPicker color={value} width="224px" disableAlpha={disableAlpha} onChangeComplete={this.onValueChange} />
        }
      >
        <div className="ticl-color-editor" style={editorStyle}>
          <div className="ticl-color-editor-preview">
            <div className="ticl-color-editor-bg" />
            <div style={{background: value}} />
          </div>
          {value}
        </div>
      </Popup>
    );
  }
}
