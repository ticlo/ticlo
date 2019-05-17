import React from "react";
import {DatePicker} from "antd";
import {PropDesc} from "../../../core/block/Descriptor";
import {ValueEditorProps} from "./ValueEditor";
import {Moment, parseZone, isMoment} from 'moment';

const {RangePicker} = DatePicker;

export class DateRangeEditor extends React.Component<ValueEditorProps, any> {

  onValueChange = (range: Moment[]) => {
    let {desc, onChange} = this.props;
    onChange(range);
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let {showTime} = desc;
    if (Array.isArray(value) && value.length === 2) {
      if (typeof value[0] === 'string' && typeof value[1] === 'string') {
        value = [parseZone(value[0]), parseZone(value[1])];
      }
      if (!isMoment(value[0]) || !isMoment(value[1]) || !(value[0] as Moment).isValid() || !(value[1] as Moment).isValid()) {
        value = null;
      }
    } else {
      value = null;
    }

    return (
      <RangePicker className='ticl-date-editor' size='small' value={value} disabled={locked || onChange == null}
                   showTime={showTime} onChange={this.onValueChange}/>
    );
  }
}
