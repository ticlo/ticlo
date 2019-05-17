import React from "react";
import {DatePicker} from "antd";
import {PropDesc} from "../../../core/block/Descriptor";
import {ValueEditorProps} from "./ValueEditor";
import {Moment, parseZone, isMoment} from 'moment';

export class DateEditor extends React.Component<ValueEditorProps, any> {

  onValueChange = (moment: Moment) => {
    let {desc, onChange} = this.props;
    console.log('onChange');
    console.log(moment);
    onChange(moment);
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let {showTime} = desc;
    if (typeof value === 'string') {
      console.log('parseZone');
      console.log(value);
      value = parseZone(value);
      console.log(value);
    }
    if (!isMoment(value) || !(value as Moment).isValid()) {
      value = null;
    }
    console.log(value);

    return (
      <DatePicker className='ticl-date-editor' size='small' value={value} disabled={locked || onChange == null} showTime={showTime}
                  onChange={this.onValueChange}/>
    );
  }
}
