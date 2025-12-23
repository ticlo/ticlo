import React from 'react';
import {LocalizedPropertyName, t} from '../../component/LocalizedLabel.js';
import {Checkbox, Select} from 'antd';
import {Calendar} from '../../component/DateTimePicker.js';
import {DateTime} from 'luxon';
import {funcDesc} from './descs.js';

interface Props {
  dates: string[];
  onValueChange: (value: unknown, field: string) => void;
}
interface State {}
export class DatesSelector extends React.PureComponent<Props, State> {
  static defaultProps: Partial<State> = {
    dates: [],
  };

  onDatesChange = (value: string[]) => {
    this.props.onValueChange?.(value, 'dates');
  };

  getCell = (date: DateTime) => {
    const {dates, onValueChange} = this.props;
    const s = date.toFormat('yyyy-MM-dd');
    const pos = dates.indexOf(s);
    const onClick =
      pos >= 0
        ? () => {
            onValueChange(dates.toSpliced(pos, 1), 'dates');
          }
        : () => {
            onValueChange([...dates, s], 'dates');
          };
    return (
      <div className={pos >= 0 ? 'ticl-calender-selected-cell' : null} onClick={onClick}>
        <div className="ticl-calender-cell-content">{date.day}</div>
      </div>
    );
  };

  render() {
    const {dates} = this.props;
    return (
      <>
        <div className="ticl-property">
          <div className="ticl-property-name">{t('Dates')}</div>
          <div className="ticl-property-value">
            <Select
              size="small"
              mode="multiple"
              value={dates}
              onChange={this.onDatesChange}
              dropdownMatchSelectWidth={false}
              placement="bottomRight"
              dropdownRender={() => <Calendar fullscreen={false} dateFullCellRender={this.getCell} />}
            />
          </div>
        </div>
      </>
    );
  }
}
