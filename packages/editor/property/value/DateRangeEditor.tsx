import React from 'react';
import {Tooltip} from 'antd';
import {DateTime} from 'luxon';
import {formatDate, resolveZone} from '@ticlo/core';
import {ValueEditorProps} from './ValueEditorBase.ts';
import {
  getDefaultPickerRangeValue,
  getShowTimeRangeOption,
  normalizePickerDate,
  RangePicker,
} from '../../component/DateTimePicker.tsx';

export class DateRangeEditor extends React.PureComponent<ValueEditorProps, any> {
  private parseRange(value: unknown, targetZone: string): [DateTime, DateTime] | null {
    if (Array.isArray(value) && value.length === 2) {
      let [start, end] = value;
      if (typeof start === 'string' && typeof end === 'string') {
        start = DateTime.fromISO(start, {zone: targetZone, setZone: true});
        end = DateTime.fromISO(end, {zone: targetZone, setZone: true});
      }
      if (DateTime.isDateTime(start) && start.isValid && DateTime.isDateTime(end) && end.isValid) {
        return [start, end];
      }
    }
    return null;
  }

  onValueChange = (range: [DateTime, DateTime]) => {
    const {name, onChange, timezone, value} = this.props;
    if (Array.isArray(range) && range.length === 2) {
      const targetZone = resolveZone(timezone);
      const hadValidValue = this.parseRange(value, targetZone) != null;
      onChange(
        [
          normalizePickerDate(range[0], targetZone, hadValidValue),
          normalizePickerDate(range[1], targetZone, hadValidValue),
        ],
        name
      );
      return;
    }
    onChange(range, name);
  };

  render() {
    const {desc, value, locked, onChange, timezone} = this.props;
    const showTime = desc.showTime !== false;
    const targetZone = resolveZone(timezone);
    const showTimeOption = showTime ? getShowTimeRangeOption(targetZone) : null;
    const parsed = this.parseRange(value, targetZone);
    const title = parsed ? `${formatDate(parsed[0], showTime)}\n${formatDate(parsed[1], showTime)}` : undefined;

    return (
      <Tooltip title={title} overlayClassName="ticl-e-tooltip">
        <RangePicker
          className="ticl-e-date-range-editor"
          size="small"
          value={parsed}
          defaultPickerValue={getDefaultPickerRangeValue(targetZone)}
          disabled={locked || onChange == null}
          showTime={showTimeOption}
          onChange={this.onValueChange}
        />
      </Tooltip>
    );
  }
}
