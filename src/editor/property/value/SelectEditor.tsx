import * as React from "react";
import {Select} from "antd";
import {PropDesc} from "../../../common/block/Descriptor";

const Option = Select.Option;

interface Props {
  value: any;
  desc: PropDesc;
  onChange: (value: any) => void;
}

export class SelectEditor extends React.Component<Props, any> {

  onValueChange = (value: string) => {
    let {onChange, desc} = this.props;
    if (desc.default === value) {
      value = undefined;
    }
    onChange(value);
  };

  render() {
    let {desc, value, onChange} = this.props;
    let {options} = desc;
    if (value === undefined && desc.default) {
      value = desc.default;
    }
    let optionNodes: React.ReactNode[] = [];
    if (Array.isArray(options)) {
      for (let opt of options) {
        optionNodes.push(<Option key={String(opt)} value={opt}>{opt}</Option>);
      }
    }
    return (
      <Select size='small' value={value} disabled={onChange == null}
              onChange={this.onValueChange}>
        {optionNodes}
      </Select>
    );
  }
}