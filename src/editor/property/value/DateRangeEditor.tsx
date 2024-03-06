import React from 'react';
import {Tooltip} from 'antd';
import dayjs, {Dayjs} from 'dayjs';
// tslint:disable-next-line:no-implicit-dependencies
import dayjsGenerateConfig from 'rc-picker/es/generate/dayjs';
import generatePicker from 'antd/es/date-picker/generatePicker';
import {PropDesc, isDayjsValid, formatDayjs} from '../../../../src/core/editor';
import {ValueEditorProps} from './ValueEditorBase';

const DatePicker = generatePicker<Dayjs>(dayjsGenerateConfig);
const {RangePicker} = DatePicker;

const defaultTimes = {
  defaultValue: [dayjs('00:00:00.000', 'HH:mm:ss.SSS'), dayjs('23:59:59.999', 'HH:mm:ss.SSS')],
};

export class DateRangeEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (range: [Dayjs, Dayjs]) => {
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
        value = [dayjs(value[0]), dayjs(value[1])];
      }
      if (!isDayjsValid(value[0]) || !isDayjsValid(value[1])) {
        value = null;
      } else {
        title = `${formatDayjs(value[0], showTime)}\n${formatDayjs(value[1], showTime)}`;
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
