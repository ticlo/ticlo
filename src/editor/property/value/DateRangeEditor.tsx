import React from 'react';
import {Tooltip} from 'antd';
import {DateTime} from 'luxon';
import {formatDate} from '../../../../src/core/editor';
import {ValueEditorProps} from './ValueEditorBase';
import {RangePicker} from '../../component/DateTimePicker';

const defaultTimes = {
  defaultValue: [
    DateTime.fromFormat('00:00:00.000', 'HH:mm:ss.SSS'),
    DateTime.fromFormat('23:59:59.999', 'HH:mm:ss.SSS'),
  ],
};

export class DateRangeEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (range: [DateTime, DateTime]) => {
    let {name, onChange} = this.props;
    onChange(range, name);
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let showTime = desc.showTime !== false;
    let showTimeOption = showTime ? defaultTimes : null;

    let title: string;
    if (Array.isArray(value) && value.length === 2) {
      if (typeof value[0] === 'string' && typeof value[1] === 'string') {
        value = [DateTime.fromISO(value[0], {setZone: true}), DateTime.fromISO(value[1], {setZone: true})];
      }
      if (!value[0]?.isValid || !value[1]?.isValid) {
        value = null;
      } else {
        title = `${formatDate(value[0], showTime)}\n${formatDate(value[1], showTime)}`;
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
