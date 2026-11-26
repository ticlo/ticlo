import React from 'react';
import {Tooltip} from 'antd';
import {DateTime} from 'luxon';
import {formatDate, resolveZone} from '@ticlo/core';
import {ValueEditorProps} from './ValueEditorBase.ts';
import {
  DatePicker,
  getDefaultPickerValue,
  getShowTimeOption,
  normalizePickerDate,
} from '../../component/DateTimePicker.tsx';

export class DateEditor extends React.PureComponent<ValueEditorProps, any> {
  private parseValue(value: unknown, targetZone: string): DateTime | null {
    if (typeof value === 'string') {
      value = DateTime.fromISO(value, {zone: targetZone, setZone: true});
    }
    return DateTime.isDateTime(value) && value.isValid ? value : null;
  }

  onValueChange = (day: DateTime) => {
    const {name, onChange, timezone, value} = this.props;
    const targetZone = resolveZone(timezone);
    const hadValidValue = this.parseValue(value, targetZone) != null;
    onChange(normalizePickerDate(day, targetZone, hadValidValue), name);
  };

  render() {
    const {desc, value, locked, onChange, timezone} = this.props;
    const showTime = desc.showTime !== false;
    const targetZone = resolveZone(timezone);
    const showTimeOption = showTime ? getShowTimeOption(targetZone) : null;
    const parsed = this.parseValue(value, targetZone);
    const title = parsed ? formatDate(parsed, showTime) : undefined;

    return (
      <Tooltip title={title} overlayClassName="ticl-e-tooltip">
        <DatePicker
          className="ticl-e-date-editor"
          size="small"
          value={parsed}
          defaultPickerValue={getDefaultPickerValue(targetZone)}
          disabled={locked || onChange == null}
          showTime={showTimeOption}
          onChange={this.onValueChange}
        />
      </Tooltip>
    );
  }
}
