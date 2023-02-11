import React from 'react';
import {DatePicker, Tooltip} from 'antd';
import {PropDesc, isMomentValid, formatMoment} from '../../../../src/core/editor';
import {ValueEditorProps} from './ValueEditorBase';
import moment from 'moment';

const defaultTime = {defaultValue: moment.parseZone('00:00:00.000', 'HH:mm:ss.SSS')};

export class DateEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (moment: moment.Moment) => {
    let {desc, onChange} = this.props;
    onChange(moment);
  };

  render() {
    let {desc, value, locked, onChange} = this.props;
    let {showTime} = desc;
    let showTimeOption = showTime ? defaultTime : null;
    let title: string;
    if (typeof value === 'string') {
      value = moment.parseZone(value);
    }
    if (!isMomentValid(value)) {
      value = null;
    } else {
      title = formatMoment(value, showTime);
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
