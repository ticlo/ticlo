import React from 'react';
import {ValueEditorProps} from '../../property/value/ValueEditorBase';
import {DateTime} from 'luxon';
import {TimePicker} from '../../component/DateTimePicker';
import {LocalizedPropertyName, t} from '../../component/LocalizedLabel';
import {InputNumber, Select} from 'antd';
import {SchedulerConfig} from '@ticlo/core/functions/date/Schedule/SchedulerEvent';
import type {FunctionDesc} from '@ticlo/core';

const funcDesc: FunctionDesc = {name: 'create-schedule'};

const {Option} = Select;

const defaultTime = DateTime.fromFormat('00:00:00.000', 'HH:mm:ss.SSS', {zone: 'Factory'});

interface Props {
  current: any;
  onChange: (values: {start?: string; duration?: number}) => void;
}
type UnitSec = 1 | 60 | -1;
interface State {
  unit: UnitSec;
  setDuration?: unknown;
}

export class TimeRangeEditor extends React.PureComponent<Props, State> {
  // Track change, if input changed and there is no editing happening, reset it
  static getDerivedStateFromProps(props: Props, state: State): State {
    const {duration} = props.current;
    const {setDuration} = state;
    if (setDuration !== duration) {
      // value changed remotely, need to update unit
      const newState: State = {...state};
      if (duration != null) {
        if (duration >= 60 && duration % 60 === 0) {
          newState.unit = 60;
        } else if (duration === 0) {
          newState.unit = -1;
        } else {
          newState.unit = 1;
        }
      }
      return newState;
    }

    return null;
  }

  state: State = {unit: 60};
  onStartChange = (day: DateTime) => {
    let {onChange} = this.props;
    onChange({start: `${day.hour}:${day.minute}`});
  };

  setDuration(duration: number) {
    const {onChange} = this.props;
    this.setState({setDuration: duration});
    onChange({duration});
  }

  onDurationChange = (value: number) => {
    const {unit} = this.state;
    this.setDuration(value * unit);
  };

  onUnitChange = (unit: any) => {
    const {onChange, current} = this.props;
    const {duration} = current;
    this.setState({unit});
    if (unit === -1) {
      onChange({start: '0:0', duration: 0});
    } else if (unit === 60) {
      if (duration <= 30) {
        this.setDuration(60);
      } else if (duration % 60 !== 0) {
        this.setDuration(Math.round(duration / 60) * 60);
      }
    } else if (unit === 1) {
      if (duration === 0) {
        this.setDuration(15);
      }
    }
  };

  render() {
    let {current} = this.props;
    const {unit} = this.state;

    let d = defaultTime;
    if (typeof current.start === 'string') {
      d = DateTime.fromFormat(current.start, 'H:m', {zone: 'Factory'});
    }

    const unitSelector = (
      <Select value={unit} size="small" onChange={this.onUnitChange} dropdownMatchSelectWidth={false}>
        <Option value={1}>{t('M')}</Option>
        <Option value={60}>{t('H')}</Option>
        <Option value={-1}>{t('All Day')}</Option>
      </Select>
    );

    return (
      <>
        <div className="ticl-property">
          <div className="ticl-property-name">
            <LocalizedPropertyName desc={funcDesc} name="start" />
          </div>
          <div className="ticl-property-value">
            <TimePicker
              className="ticl-date-editor"
              format="HH:mm"
              allowClear={false}
              size="small"
              value={d}
              showNow={false}
              onChange={this.onStartChange}
            />
          </div>
        </div>
        <div className="ticl-property">
          <div className="ticl-property-name">
            <LocalizedPropertyName desc={funcDesc} name="duration" />
          </div>
          <div className="ticl-property-value">
            {unit > 0 ? (
              <InputNumber
                size="small"
                min={1}
                value={current.duration / unit}
                addonAfter={unitSelector}
                onChange={this.onDurationChange}
              />
            ) : (
              unitSelector
            )}
          </div>
        </div>
      </>
    );
  }
}
