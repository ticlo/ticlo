import React from 'react';
import generatePicker, {PickerProps} from 'antd/es/date-picker/generatePicker';
import type {RangePickerProps} from 'antd/es/date-picker/generatePicker/interface';
import generateCalendar from 'antd/es/calendar/generateCalendar';
import {DateTime} from 'luxon';
import luxonConfig from '../property/value/3rd-party/luxonConfig';

type DatePickerType = React.ForwardRefExoticComponent<PickerProps<DateTime> & React.RefAttributes<any>> & {
  RangePicker: React.ComponentType<RangePickerProps<DateTime>>;
  [key: string]: any;
};

const DatePicker = generatePicker<DateTime>(luxonConfig) as unknown as DatePickerType;

const {RangePicker} = DatePicker;

interface TimePickerProps extends Omit<PickerProps<DateTime>, 'picker'> {}

const TimePicker = React.forwardRef<any, TimePickerProps>((props, ref) => {
  return <DatePicker {...props} picker="time" mode={undefined} ref={ref} />;
});

TimePicker.displayName = 'TimePicker';

const Calendar = generateCalendar<DateTime>(luxonConfig);

export {DatePicker, RangePicker, TimePicker, Calendar};
