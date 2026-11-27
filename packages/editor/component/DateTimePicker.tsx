import React from 'react';
import * as generatePickerNS from 'antd/es/date-picker/generatePicker/index.js';
const generatePicker = generatePickerNS.default;
import type {PickerProps} from 'antd/es/date-picker/generatePicker/index.js';
import type {RangePickerProps} from 'antd/es/date-picker/generatePicker/interface.js';
import * as generateCalendarNS from 'antd/es/calendar/generateCalendar.js';
const generateCalendar = generateCalendarNS.default;
import {DateTime} from 'luxon';
import luxonConfig from '../property/value/3rd-party/luxonConfig.ts';
import {getZoneObject} from '@ticlo/core/util/DateTime.ts';

type DatePickerType = React.ForwardRefExoticComponent<PickerProps<DateTime> & React.RefAttributes<any>> & {
  RangePicker: React.ComponentType<RangePickerProps<DateTime>>;
  [key: string]: any;
};

const DatePicker = (generatePicker as unknown as <T>(config: any) => any)<DateTime>(
  luxonConfig
) as unknown as DatePickerType;

const {RangePicker} = DatePicker;

interface TimePickerProps extends Omit<PickerProps<DateTime>, 'picker'> {}

const TimePicker = React.forwardRef<any, TimePickerProps>((props, ref) => {
  return <DatePicker {...props} picker="time" mode={undefined} ref={ref} />;
});

TimePicker.displayName = 'TimePicker';

const Calendar = (generateCalendar as unknown as <T>(config: any) => any)<DateTime>(luxonConfig);

const showTimeCache = new Map<string, {defaultValue: DateTime}>();
const showTimeRangeCache = new Map<string, {defaultValue: [DateTime, DateTime]}>();
const pickerDayCache = new Map<string, {dayKey: string; value: DateTime; pair: [DateTime, DateTime]}>();

export function getShowTimeOption(targetZone: string): {defaultValue: DateTime} {
  let cached = showTimeCache.get(targetZone);
  if (!cached) {
    cached = {
      defaultValue: DateTime.fromFormat('00:00:00.000', 'HH:mm:ss.SSS', getZoneObject(targetZone)),
    };
    showTimeCache.set(targetZone, cached);
  }
  return cached;
}

export function getShowTimeRangeOption(targetZone: string): {defaultValue: [DateTime, DateTime]} {
  let cached = showTimeRangeCache.get(targetZone);
  if (!cached) {
    const zoneObj = getZoneObject(targetZone);
    cached = {
      defaultValue: [
        DateTime.fromFormat('00:00:00.000', 'HH:mm:ss.SSS', zoneObj),
        DateTime.fromFormat('23:59:59.999', 'HH:mm:ss.SSS', zoneObj),
      ],
    };
    showTimeRangeCache.set(targetZone, cached);
  }
  return cached;
}

export function getDefaultPickerValue(targetZone: string): DateTime {
  const now = DateTime.now().setZone(targetZone);
  const dayKey = now.toISODate();
  let cached = pickerDayCache.get(targetZone);
  if (!cached || cached.dayKey !== dayKey) {
    const start = now.startOf('day');
    cached = {dayKey, value: start, pair: [start, start]};
    pickerDayCache.set(targetZone, cached);
  }
  return cached.value;
}

export function getDefaultPickerRangeValue(targetZone: string): [DateTime, DateTime] {
  getDefaultPickerValue(targetZone);
  return pickerDayCache.get(targetZone).pair;
}

export function normalizePickerDate(day: DateTime, targetZone: string, hadValidValue: boolean): DateTime {
  if (!day?.isValid || hadValidValue || day.zoneName === targetZone) {
    return day;
  }
  // Clicking "Now" produces a timestamp close to Date.now(); preserve the instant in targetZone.
  if (Math.abs(day.toMillis() - Date.now()) < 2000) {
    return day.setZone(targetZone);
  }
  return day.setZone(targetZone, {keepLocalTime: true});
}

export {DatePicker, RangePicker, TimePicker, Calendar};
