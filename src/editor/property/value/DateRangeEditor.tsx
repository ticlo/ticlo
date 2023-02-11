import React from 'react';
import {DatePicker, Tooltip} from 'antd';
import {PropDesc, isMomentValid, formatMoment} from '../../../../src/core/editor';
import {ValueEditorProps} from './ValueEditorBase';
import moment from 'moment';

const {RangePicker} = DatePicker;

const defaultTimes = {
  defaultValue: [moment.parseZone('00:00:00.000', 'HH:mm:ss.SSS'), moment.parseZone('23:59:59.999', 'HH:mm:ss.SSS')],
};

export class DateRangeEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (range: [moment.Moment, moment.Moment]) => {
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
        value = [moment.parseZone(value[0]), moment.parseZone(value[1])];
      }
      if (!isMomentValid(value[0]) || !isMomentValid(value[1])) {
        value = null;
      } else {
        title = `${formatMoment(value[0], showTime)}\n${formatMoment(value[1], showTime)}`;
      }
    } else {
      value = null;
    }

    return (
      <Tooltip title={title} overlayClassName="ticl-tooltip">
        <RangePicker
          className="ticl-date-range-editor"
          size="small"
          value={value}
          disabled={locked || onChange == null}
          showTime={showTimeOption}
          onChange={this.onValueChange}
        />
      </Tooltip>
    );
  }
}
