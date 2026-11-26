import React from 'react';
import {t} from '../../component/LocalizedLabel.tsx';
import {Select} from 'antd';
import {Calendar, getDefaultPickerValue} from '../../component/DateTimePicker.tsx';
import {resolveZone} from '@ticlo/core';
import {DateTime} from 'luxon';

interface Props {
  dates: string[];
  zone?: string;
  onValueChange: (value: unknown, field: string) => void;
}
interface State {}
export class DatesSelector extends React.PureComponent<Props, State> {
  static defaultProps: Partial<Props> = {
    dates: [],
  };

  onDatesChange = (value: string[]) => {
    this.props.onValueChange?.(value, 'dates');
  };

  getCell = (date: DateTime) => {
    const {dates, onValueChange} = this.props;
    const safeDates = Array.isArray(dates) ? dates : [];
    const s = date.toFormat('yyyy-MM-dd');
    const pos = safeDates.indexOf(s);
    const onClick =
      pos >= 0
        ? () => {
            onValueChange(safeDates.toSpliced(pos, 1), 'dates');
          }
        : () => {
            onValueChange([...safeDates, s], 'dates');
          };
    return (
      <div className={pos >= 0 ? 'ant-picker-cell-in-view ant-picker-cell-selected' : null} onClick={onClick}>
        <div className="ant-picker-cell-inner">{date.day}</div>
      </div>
    );
  };

  render() {
    const {dates, zone} = this.props;
    const safeDates = Array.isArray(dates) ? dates : [];
    const defaultValue = getDefaultPickerValue(resolveZone(zone));
    return (
      <>
        <div className="ticl-e-property">
          <div className="ticl-e-property-name">{t('Dates')}</div>
          <div className="ticl-e-property-value">
            <Select
              size="small"
              mode="multiple"
              value={safeDates}
              onChange={this.onDatesChange}
              dropdownMatchSelectWidth={false}
              placement="bottomRight"
              dropdownRender={() => (
                <Calendar fullscreen={false} defaultValue={defaultValue} dateFullCellRender={this.getCell} />
              )}
            />
          </div>
        </div>
      </>
    );
  }
}
