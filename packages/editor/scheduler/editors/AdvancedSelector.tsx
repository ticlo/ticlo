import React, {ReactElement} from 'react';
import {Button, Checkbox, Select, Tag, Tooltip} from 'antd';
import {CloseOutlined, PlusOutlined} from '@ant-design/icons';
import {SchedulerConfig} from '@ticlo/core/functions/date/Schedule/SchedulerEvent.js';
import {cacheCall} from '../../util/CachedCallback.js';
import {translateProperty, translatePropContent} from '@ticlo/core/util/i18n.js';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext.js';

import {stopPropagation} from '@ticlo/core';
import {LocalizedPropertyName, t} from '../../component/LocalizedLabel.js';
import {FUNC, funcDesc} from './descs.js';

const CURRENT_YEAR = new Date().getFullYear();
// create 20 years for the dropdown
const YEAR_OPTIONS = Array.from({length: 20}, (_, i) => ({
  value: i + CURRENT_YEAR,
}));

const RIGHT_ALIGN_STYLE = {display: 'flex', justifyContent: 'end', overflow: 'visible'};

function isRangeAllowed(days: (number | string)[]) {
  return days?.length === 2 && !days.find((v) => typeof v === 'string' && v.startsWith('0>'));
}

// Tag for the days multi-selector
function DayTag({value, onClose}: {value: number | string; onClose: (e: React.MouseEvent<HTMLElement>) => void}) {
  let label: string;
  if (typeof value === 'number') {
    label = value.toString();
  } else if (typeof value === 'string') {
    const parts = value.split('>');
    const type = parts[1];
    const unit = type === '0' ? '' : translatePropContent(FUNC, 'days', '@dayUnit');
    const dayName = translatePropContent(FUNC, 'days', type);
    const count = parseFloat(parts[0]);
    label = translatePropContent(FUNC, 'days', `nth_ranged`, undefined, {
      d: dayName,
      u: unit,
      count,
      postProcess: 'ranged',
      defaultValue: value,
    });
  }
  return (
    <span className="ant-select-selection-item" title={label}>
      <span className="ant-select-selection-item-content">{label}</span>
      <span
        className="ant-select-selection-item-remove"
        unselectable="on"
        aria-hidden="true"
        style={{userSelect: 'none'}}
        onMouseDown={stopPropagation}
        onClick={onClose}
      >
        <CloseOutlined />
      </span>
    </span>
  );
}

interface Props {
  current: Partial<SchedulerConfig>;
  onValueChange: (value: unknown, field: string) => void;
}

interface States {
  dayCount: number;
  dayType: number;
}

interface SelectOption {
  label: React.ReactNode;
  value?: string | number | null;
}

export class AdvancedSelector extends React.PureComponent<Props, States> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  state: States = {dayCount: 1, dayType: 1};

  onYearsChange = (years: number[]) => {
    this.props.onValueChange(years.map((y) => Number(y)).filter(Number.isInteger), 'years');
  };
  onMonthsChange = (months: number[]) => {
    this.props.onValueChange(months, 'months');
  };
  onDaysChange = (days: (number | string)[]) => {
    this.props.onValueChange(days, 'days');
    if (!isRangeAllowed(days) && this.props.current.range) {
      this.props.onValueChange(false, 'range');
    }
  };
  onRangeChange = (e: {target: {checked: boolean}}) => {
    this.props.onValueChange(e.target.checked, 'range');
  };
  onDayCountChange = (dayCount: number) => {
    this.setState({dayCount});
  };
  onDayTypeChange = (dayType: number) => {
    this.setState({dayType});
  };
  addDay = () => {
    const {dayCount, dayType} = this.state;
    if (dayCount === 0 && dayType === 0) {
      // every day, remove all the days
      this.props.onValueChange([], 'days');
      return;
    }
    const {days} = this.props.current;
    const str = `${dayCount}>${dayType}`;
    if (!days?.includes(str)) {
      this.props.onValueChange([...days, str], 'days');
    }
  };
  getLocalizedOptions = cacheCall((context: unknown) => {
    const monthOptions: SelectOption[] = [];
    const dayCountOptions: SelectOption[] = [];
    const dayTypeOptions: SelectOption[] = [];
    for (let i = 1; i <= 12; ++i) {
      monthOptions.push({
        label: translatePropContent(FUNC, 'months', i.toString()),
        value: i,
      });
    }
    for (let i = -1; i <= 4; ++i) {
      dayCountOptions.push({
        label: translatePropContent(FUNC, 'days', 'nth_ranged', undefined, {
          d: '',
          u: translatePropContent(FUNC, 'days', '@dayUnit'),
          count: i,
          postProcess: 'ranged',
          defaultValue: i.toString(),
        }),
        value: i,
      });
    }
    for (let i = 0; i <= 9; ++i) {
      dayTypeOptions.push({
        label: translatePropContent(FUNC, 'days', i.toString()),
        value: i,
      });
    }

    const daysName = translateProperty(FUNC, 'days');
    const monthsName = translateProperty(FUNC, 'months');
    const yearsName = translateProperty(FUNC, 'years');
    const daysPlaceHolder = translatePropContent(FUNC, 'days', '@placeholder');
    const monthsPlaceHolder = translatePropContent(FUNC, 'months', '@placeholder');
    const yearsPlaceHolder = translatePropContent(FUNC, 'years', '@placeholder');
    return {
      daysName,
      daysPlaceHolder,
      monthOptions,
      dayCountOptions,
      dayTypeOptions,
      monthsName,
      yearsName,
      monthsPlaceHolder,
      yearsPlaceHolder,
    };
  }, null);

  // menu for the days dropdown
  DaysDropdown = cacheCall((days: (number | string)[]) => {
    const rows: React.ReactElement[] = [];
    let row: React.ReactElement[];

    const {onValueChange} = this.props;
    const actualDays = Array.isArray(days) ? days : [];

    for (let i = 1; i <= 31; ++i) {
      if (!row) {
        row = [];
      }
      const pos = actualDays.indexOf(i);
      const onClick =
        pos >= 0
          ? () => {
              onValueChange(actualDays.toSpliced(pos, 1), 'days');
            }
          : () => {
              onValueChange([...actualDays, i], 'days');
            };
      row.push(
        <td key={i} className={`ant-picker-cell ant-picker-cell-in-view${pos >= 0 ? ' ant-picker-cell-selected' : ''}`} onClick={onClick}>
          <div className="ant-picker-cell-inner">{i}</div>
        </td>
      );
      if (row.length === 7) {
        rows.push(<tr key={i}>{row}</tr>);
        row = null;
      }
    }
    rows.push(<tr key={31}>{row}</tr>);
    return (
      <div className="ticl-schedule-days-dropdown ant-picker-dropdown css-var-r0 ant-picker-css-var">
        <div className="ant-picker-date-panel">
          <div className="ant-picker-body">
            <table className="ant-picker-content">
              <tbody>{rows}</tbody>
            </table>
          </div>
        </div>
      </div>
    );
  });

  render() {
    const {years, months, days, range} = this.props.current;
    const {dayCount, dayType} = this.state;
    const {
      daysName,
      daysPlaceHolder,
      monthOptions,
      dayCountOptions,
      dayTypeOptions,
      monthsName,
      yearsName,
      monthsPlaceHolder,
      yearsPlaceHolder,
    } = this.getLocalizedOptions(
      [this.context] // add extra layer of array, so the shallow equal will only compare the whole object, not internal content
    );
    return (
      <>
        <div className="ticl-property">
          <div className="ticl-property-name">{yearsName}</div>
          <div className="ticl-property-value">
            <Select
              size="small"
              mode="tags"
              value={years}
              options={YEAR_OPTIONS}
              placeholder={yearsPlaceHolder}
              onChange={this.onYearsChange}
            />
          </div>
        </div>
        <div className="ticl-property">
          <div className="ticl-property-name">{monthsName}</div>
          <div className="ticl-property-value">
            <Select
              size="small"
              mode="multiple"
              value={months}
              options={monthOptions}
              placeholder={monthsPlaceHolder}
              onChange={this.onMonthsChange}
            />
          </div>
        </div>
        <div className="ticl-property">
          <div className="ticl-property-name">{daysName}</div>
          <div className="ticl-property-value">
            <Select
              size="small"
              mode="multiple"
              value={days}
              placeholder={daysPlaceHolder}
              onChange={this.onDaysChange}
              tagRender={DayTag}
              dropdownMatchSelectWidth={false}
              placement="bottomRight"
              dropdownRender={() => this.DaysDropdown(days)}
            />
          </div>
        </div>
        {isRangeAllowed(days) && (
          <div className="ticl-property">
            <div className="ticl-property-name" />
            <div className="ticl-property-value">
              <Checkbox onChange={this.onRangeChange}>
                <LocalizedPropertyName desc={funcDesc} name="range" />
              </Checkbox>
            </div>
          </div>
        )}
        <div className="ticl-property">
          <div className="ticl-property-name" />
          <div className="ticl-property-value" style={RIGHT_ALIGN_STYLE}>
            <div style={{width: 0, ...RIGHT_ALIGN_STYLE}}>
              <Tooltip title={t('Add Day')}>
                <Button
                  size="small"
                  shape="circle"
                  icon={<PlusOutlined />}
                  style={{marginRight: 4}}
                  onClick={this.addDay}
                />
              </Tooltip>
            </div>
            <Select size="small" value={dayCount} options={dayCountOptions} onChange={this.onDayCountChange} />
            <Select size="small" value={dayType} options={dayTypeOptions} onChange={this.onDayTypeChange} />
          </div>
        </div>
      </>
    );
  }
}
