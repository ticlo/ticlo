import React from 'react';
import * as generatePickerNS from 'antd/es/date-picker/generatePicker/index.js';
const generatePicker = generatePickerNS.default;
import type {PickerProps} from 'antd/es/date-picker/generatePicker/index.js';
import type {RangePickerProps} from 'antd/es/date-picker/generatePicker/interface.js';
import * as generateCalendarNS from 'antd/es/calendar/generateCalendar.js';
const generateCalendar = generateCalendarNS.default;
import {DateTime} from 'luxon';
import luxonConfig from '../property/value/3rd-party/luxonConfig.js';

type DatePickerType = React.ForwardRefExoticComponent<PickerProps<DateTime> & React.RefAttributes<any>> & {
  RangePicker: React.ComponentType<RangePickerProps<DateTime>>;
  [key: string]: any;
};

const DatePicker = (generatePicker as unknown as <T>(config: any) => any)<DateTime>(luxonConfig) as unknown as DatePickerType;

const {RangePicker} = DatePicker;

interface TimePickerProps extends Omit<PickerProps<DateTime>, 'picker'> {}

const TimePicker = React.forwardRef<any, TimePickerProps>((props, ref) => {
  return <DatePicker {...props} picker="time" mode={undefined} ref={ref} />;
});

TimePicker.displayName = 'TimePicker';

const Calendar = (generateCalendar as unknown as <T>(config: any) => any)<DateTime>(luxonConfig);

export {DatePicker, RangePicker, TimePicker, Calendar};
