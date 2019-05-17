import React from "react";
import {DatePicker, Tooltip} from "antd";
import {PropDesc} from "../../../core/block/Descriptor";
import {ValueEditorProps} from "./ValueEditor";
import {Moment, parseZone, isMoment} from 'moment';
import * as MomentUtil from '../../../core/util/Moment';

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
    let title: string;
    if (typeof value === 'string') {
      value = parseZone(value);
    }
    if (!isMoment(value) || !(value as Moment).isValid()) {
      value = null;
    } else {
      title = MomentUtil.formatMoment(value, showTime);
    }

    return (
      <Tooltip title={title} overlayClassName='ticl-tooltip'>
        <DatePicker className='ticl-date-editor' size='small' value={value} disabled={locked || onChange == null}
                    showTime={showTime}
                    onChange={this.onValueChange} style={
          /*work around of https://github.com/ant-design/ant-design/issues/16651*/
          {minWidth: null}}/>
      </Tooltip>
    );
  }
}
