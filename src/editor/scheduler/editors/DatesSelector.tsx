import React from 'react';
import {t} from '../../component/LocalizedLabel';
import {MultiSelectEditor} from '../../property/value/SelectEditor';
import {Select} from 'antd';
import {DatePicker, Calendar} from '../../component/DateTimePicker';
import {DateTime} from 'luxon';
import {translateEditor} from '../../../core/util/i18n';
import {scat} from '../../../core/util/String';

const defaultDate = DateTime.now();

interface Props {
  dates: string[];
  onChange: (dates: string[], field: string) => void;
}
interface State {}
export class DatesSelector extends React.PureComponent<Props, State> {
  static defaultProps: Partial<State> = {
    dates: [],
  };

  onDatesChange = (value: string[]) => {
    this.props.onChange?.(value, 'dates');
  };
  onNewDate = (value: DateTime) => {
    const newDate = value.toFormat('yyyy-MM-dd');
    const {dates, onChange} = this.props;
    if (!dates?.includes(newDate)) {
      onChange([...dates, newDate], 'dates');
    }
  };

  getCell = (date: DateTime) => {
    const {dates, onChange} = this.props;
    const s = date.toFormat('yyyy-MM-dd');
    const pos = dates.indexOf(s);
    const onClick =
      pos >= 0
        ? () => {
            onChange(dates.toSpliced(pos, 1), 'dates');
          }
        : () => {
            onChange([...dates, s], 'dates');
          };
    return (
      <div className={pos >= 0 ? 'ticl-calender-selected-cell' : null} onClick={onClick}>
        <div className="ticl-calender-cell-content">{date.day}</div>
      </div>
    );
  };

  render() {
    const {dates, onChange} = this.props;
    return (
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
            dropdownRender={(menu) => <Calendar fullscreen={false} dateFullCellRender={this.getCell} />}
          />
        </div>
      </div>
    );
  }
}
