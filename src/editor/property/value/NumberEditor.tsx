import * as React from "react";
import {InputNumber} from "antd";
import {PropDesc} from "../../../common/block/Descriptor";

interface Props {
  value: any;
  desc: PropDesc;
  onChange: (value: any) => void;
}

export class NumberEditor extends React.Component<Props, any> {



  shouldComponentUpdate(nextProps: Readonly<Props>, nextState: Readonly<any>, nextContext: any) {
    let props = this.props;
    if (props.desc !== nextProps.desc) {
      return true;
    }
    if (props.onChange !== nextProps.onChange) {
      return true;
    }
    if (!Object.is(props.value, nextProps.value)){

    }
  }

  render() {
    let {desc, value, onChange} = this.props;
    return (
      <InputNumber size='small' placeholder={desc.placeholder} min={desc.min} max={desc.max} step={desc.step} defaultValue={value} onChange={onChange}/>
    );
  }

}