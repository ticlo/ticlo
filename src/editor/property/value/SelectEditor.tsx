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
    let {onChange} = this.props;
    onChange(value);
  };

  render() {
    let {desc, value, onChange} = this.props;
    let {options} = desc;
    let optionNodes: React.ReactNode[] = [];
    if (Array.isArray(options)) {
      for (let opt of options) {
        optionNodes.push(<Option key={opt} value={opt}>{opt}</Option>);
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