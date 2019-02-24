import * as React from "react";
import {Select} from "antd";
import {PropDesc} from "../../../common/block/Descriptor";
import {ValueEditorProps} from "./ValueEditor";

const Option = Select.Option;

export class SelectEditor extends React.Component<ValueEditorProps, any> {

  onValueChange = (value: string) => {
    let {onChange} = this.props;
    onChange(value);
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let {options} = desc;
    let optionNodes: React.ReactNode[] = [];
    if (Array.isArray(options)) {
      for (let opt of options) {
        optionNodes.push(<Option key={String(opt)} value={opt}>{opt}</Option>);
      }
    }
    return (
      <Select size='small' value={value} disabled={locked || onChange == null}
              onChange={this.onValueChange}>
        {optionNodes}
      </Select>
    );
  }
}
