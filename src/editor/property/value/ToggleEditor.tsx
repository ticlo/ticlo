import * as React from "react";
import {Switch} from "antd";
import {PropDesc} from "../../../common/block/Descriptor";


interface Props {
  value: any;
  desc: PropDesc;
  onChange: (value: any) => void;
}

export class ToggleEditor extends React.Component<Props, any> {

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
    let {desc, value, onChange} = this.props;
    let {options} = desc;
    let checkedChildren: string;
    let unCheckedChildren: string;
    if (options && options.length >= 2) {
      // convert string to boolean
      unCheckedChildren = options[0] as any;
      checkedChildren = options[1] as any;
      if (typeof value === 'string') {
        value = (value === checkedChildren);
      }
    }
    return (
      <Switch checked={value} disabled={onChange == null}
              unCheckedChildren={unCheckedChildren} checkedChildren={checkedChildren}
              onChange={this.onValueChange}/>
    );
  }
}