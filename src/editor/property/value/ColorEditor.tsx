import React from "react";
import {Switch} from "antd";
require('rc-trigger'); // work around for karma-typescript
import Trigger from 'rc-trigger';
import {SketchPicker} from 'react-color';
import {PropDesc} from "../../../core/block/Descriptor";
import {ValueEditorProps} from "./ValueEditor";

export class ColorEditor extends React.Component<ValueEditorProps, any> {

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
    // let {options} = desc;
    // let checkedChildren: string;
    // let unCheckedChildren: string;
    // if (options && options.length >= 2) {
    //   // convert string to boolean
    //   unCheckedChildren = String(options[0]);
    //   checkedChildren = String(options[1]);
    //   if (typeof value === 'string' || typeof value === 'number') {
    //     value = (value === options[1]);
    //   }
    // }
    return (
      <Trigger action={['click']}
               popupAlign={{
                 points: ['tl', 'bl'],
                 offset: [0, 3]
               }}
               popup={
        <SketchPicker color='#f0f'/>
      }>
        <span>hello</span>
      </Trigger>
    );
  }
}
