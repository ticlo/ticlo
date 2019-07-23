import React from "react";
import {DatePicker, Tooltip} from "antd";
import {PropDesc} from "../../../core/block/Descriptor";
import {ValueEditorProps} from "./ValueEditorBase";
import {Moment, parseZone, isMoment} from 'moment';
import * as MomentUtil from '../../../core/util/Moment';

const defaultTime = {defaultValue: parseZone('00:00:00.000', 'HH:mm:ss.SSS')};

export class DateEditor extends React.PureComponent<ValueEditorProps, any> {

  onValueChange = (moment: Moment) => {
    let {desc, onChange} = this.props;
    onChange(moment);
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let {showTime} = desc;
    let showTimeOption = showTime ? defaultTime : null;
    let title: string;
    if (typeof value === 'string') {
      value = parseZone(value);
    }
    if (!MomentUtil.isValid(value)) {
      value = null;
    } else {
      title = MomentUtil.formatMoment(value, showTime);
    }

    return (
      <Tooltip title={title} overlayClassName='ticl-tooltip'>
        <DatePicker className='ticl-date-editor' size='small' value={value} disabled={locked || onChange == null}
                    showTime={showTimeOption} onChange={this.onValueChange} style={
          /*work around of https://github.com/ant-design/ant-design/issues/16651*/
          {minWidth: null}}/>
      </Tooltip>
    );
  }
}
