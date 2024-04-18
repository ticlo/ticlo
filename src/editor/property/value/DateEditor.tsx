import React from 'react';
import {Tooltip} from 'antd';
import {DateTime} from 'luxon';
import generatePicker from 'antd/es/date-picker/generatePicker';
import {formatDate} from '../../../../src/core/editor';
import {ValueEditorProps} from './ValueEditorBase';
import luxonConfig from './3rd-party/luxonConfig';

const DatePicker = generatePicker<DateTime>(luxonConfig);

const defaultTime = {defaultValue: DateTime.fromFormat('00:00:00.000', 'HH:mm:ss.SSS')};

export class DateEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (day: DateTime) => {
    let {desc, onChange} = this.props;
    onChange(day);
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
          style={
            /*work around of https://github.com/ant-design/ant-design/issues/16651*/
            {minWidth: null}
          }
        />
      </Tooltip>
    );
  }
}
