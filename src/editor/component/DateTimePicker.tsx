import React from 'react';
import generatePicker, {PickerTimeProps} from 'antd/es/date-picker/generatePicker';
import {DateTime} from 'luxon';
import luxonConfig from '../property/value/3rd-party/luxonConfig';

const DatePicker = generatePicker<DateTime>(luxonConfig);

const {RangePicker} = DatePicker;

interface TimePickerProps extends Omit<PickerTimeProps<DateTime>, 'picker'> {}

const TimePicker = React.forwardRef<any, TimePickerProps>((props, ref) => {
  return <DatePicker {...props} picker="time" mode={undefined} ref={ref} />;
});

TimePicker.displayName = 'TimePicker';

export {DatePicker, RangePicker, TimePicker};
