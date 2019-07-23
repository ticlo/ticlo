import React from "react";
import {Radio} from "antd";
import {PropDesc} from "../../../core/block/Descriptor";
import {ValueEditorProps} from "./ValueEditorBase";
import {RadioChangeEvent} from "antd/lib/radio";

const RadioButton = Radio.Button;
const RadioGroup = Radio.Group;


export class RadioButtonEditor extends React.PureComponent<ValueEditorProps, any> {

  onValueChange = (e: RadioChangeEvent) => {
    let {onChange} = this.props;
    onChange(e.target.value);
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let {options} = desc;
    let optionNodes: React.ReactNode[] = [];
    if (Array.isArray(options)) {
      for (let opt of options) {
        optionNodes.push(<RadioButton key={String(opt)} value={opt}>{opt}</RadioButton>);
      }
    }
    return (
      <RadioGroup size='small' buttonStyle='solid' value={value} disabled={locked || onChange == null}
                  onChange={this.onValueChange}>
        {optionNodes}
      </RadioGroup>
    );
  }
}
