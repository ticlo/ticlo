import React from 'react';
import {Tooltip} from 'antd';
import dayjs, {Dayjs} from 'dayjs';
// tslint:disable-next-line:no-implicit-dependencies
import dayjsGenerateConfig from 'rc-picker/es/generate/dayjs';
import generatePicker from 'antd/es/date-picker/generatePicker';
import {PropDesc, isDayjsValid, formatDayjs} from '../../../../src/core/editor';
import {ValueEditorProps} from './ValueEditorBase';

const DatePicker = generatePicker<Dayjs>(dayjsGenerateConfig);

const defaultTime = {defaultValue: dayjs('00:00:00.000', 'HH:mm:ss.SSS')};

export class DateEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (day: Dayjs) => {
    let {desc, onChange} = this.props;
    onChange(day);
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let showTime = desc.showTime !== false;
    let showTimeOption = showTime ? defaultTime : null;
    let title: string;
    if (typeof value === 'string') {
      value = dayjs(value);
    }
    if (!isDayjsValid(value)) {
      value = null;
    } else {
      title = formatDayjs(value, showTime);
    }

    return (
      <Tooltip title={title} overlayClassName="ticl-tooltip">
        <DatePicker
          className="ticl-date-editor"
          size="small"
          value={value}
          disabled={locked || onChange == null}
          showTime={showTimeOption}
          onChange={this.onValueChange}
          style={
            /*work around of https://github.com/ant-design/ant-design/issues/16651*/
            {minWidth: null}
          }
        />
      </Tooltip>
    );
  }
}
