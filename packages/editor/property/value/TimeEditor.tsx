import React from 'react';
import {DateTime} from 'luxon';
import {ValueEditorProps} from './ValueEditorBase.js';
import {TimePicker} from '../../component/DateTimePicker.js';

const defaultTime = DateTime.fromFormat('00:00:00.000', 'HH:mm:ss.SSS', {zone: 'UTC'});

export class TimeEditor extends React.PureComponent<ValueEditorProps, any> {
  onValueChange = (day: DateTime) => {
    const {name, onChange} = this.props;
    onChange([day.hour, day.minute], name);
  };

  render() {
    const {value, locked, onChange} = this.props;

    let d = defaultTime;
    if (Array.isArray(value)) {
      d = defaultTime.set({day: value[0], minute: value[1]});
    }

    return (
      <TimePicker
        className="ticl-date-editor"
        format="HH:mm"
        allowClear={false}
        size="small"
        value={d}
        disabled={locked || onChange == null}
        onChange={this.onValueChange}
      />
    );
  }
}
