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
    let {enums} = desc;
    if (enums && enums.length >= 2) {
      // convert string to boolean
      onChange(checked ? enums[1] : enums[0]);
    } else {
      onChange(checked);
    }
  };

  render() {
    let {desc, value, onChange} = this.props;
    let {enums} = desc;
    let checkedChildren: string;
    let unCheckedChildren: string;
    if (enums && enums.length >= 2) {
      // convert string to boolean
      unCheckedChildren = enums[0];
      checkedChildren = enums[1];
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