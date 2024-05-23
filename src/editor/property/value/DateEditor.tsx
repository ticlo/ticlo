import React from 'react';
import {Tooltip} from 'antd';
import {DateTime} from 'luxon';
import {formatDate} from '../../../../src/core/editor';
import {ValueEditorProps} from './ValueEditorBase';
import {DatePicker} from '../../component/DateTimePicker';

const defaultTime = {defaultValue: DateTime.fromFormat('00:00:00.000', 'HH:mm:ss.SSS')};

export class DateEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (day: DateTime) => {
    let {name, onChange} = this.props;
    onChange(day, name);
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let showTime = desc.showTime !== false;
    let showTimeOption = showTime ? defaultTime : null;
    let title: string;
    if (typeof value === 'string') {
      value = DateTime.fromISO(value, {setZone: true});
    }
    if (!value?.isValid) {
      value = null;
    } else {
      title = formatDate(value, showTime);
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
        />
      </Tooltip>
    );
  }
}
