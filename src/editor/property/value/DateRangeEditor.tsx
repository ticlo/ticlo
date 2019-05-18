import React from "react";
import {DatePicker, Tooltip} from "antd";
import {PropDesc} from "../../../core/block/Descriptor";
import {ValueEditorProps} from "./ValueEditor";
import * as MomentUtil from "../../../core/util/Moment";
import {isMoment, Moment, parseZone} from "moment";

const {RangePicker} = DatePicker;

const defaultTimes = {defaultValue: [parseZone('00:00:00.000', 'HH:mm:ss.SSS'), parseZone('23:59:59.999', 'HH:mm:ss.SSS')]};

export class DateRangeEditor extends React.Component<ValueEditorProps, any> {

  onValueChange = (range: Moment[]) => {
    let {desc, onChange} = this.props;
    onChange(range);
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let {showTime} = desc;
    let showTimeOption = showTime ? defaultTimes : null;

    let title: string;
    if (Array.isArray(value) && value.length === 2) {
      if (typeof value[0] === 'string' && typeof value[1] === 'string') {
        value = [parseZone(value[0]), parseZone(value[1])];
      }
      if (!MomentUtil.isValid(value[0]) || !MomentUtil.isValid(value[1])) {
        value = null;
      } else {
        title = `${MomentUtil.formatMoment(value[0], showTime)}\n${MomentUtil.formatMoment(value[1], showTime)}`;
      }
    } else {
      value = null;
    }

    return (
      <Tooltip title={title} overlayClassName='ticl-tooltip'>
        <RangePicker className='ticl-date-range-editor' size='small' value={value} disabled={locked || onChange == null}
                     showTime={showTimeOption} onChange={this.onValueChange}/>
      </Tooltip>
    );
  }
}
