import React, {ReactElement} from 'react';
import {Button, Checkbox, ConfigProvider, Select, Tag, Tooltip} from 'antd';
import {CloseOutlined, PlusOutlined} from '@ant-design/icons';
import {SchedulerConfig} from '@ticlo/core/functions/date/Schedule/SchedulerEvent.ts';
import {cacheCall} from '../../util/CachedCallback.ts';
import {translateProperty, translatePropContent} from '@ticlo/core/util/i18n.ts';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext.ts';

import {stopPropagation} from '@ticlo/core';
import {LocalizedPropertyName, t} from '../../component/LocalizedLabel.tsx';
import {FUNC, funcDesc, sortDateItem} from './descs.ts';

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
  onValuesChange: (values: Partial<SchedulerConfig>, fullValue?: boolean) => void;
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

  updateDays = (nextDays: (number | string)[]) => {
    const {current, onValuesChange} = this.props;
    const sorted = [...nextDays].sort(sortDateItem);
    if (!isRangeAllowed(sorted) && current.range) {
      const copy: Partial<SchedulerConfig> = {...current, days: sorted};
      delete copy.range;
      onValuesChange(copy, true);
    } else {
      onValuesChange({days: sorted});
    }
  };

  onYearsChange = (years: number[]) => {
    const sorted = years
      .map((y) => Number(y))
      .filter(Number.isInteger)
      .sort(sortDateItem);
    this.props.onValuesChange({years: sorted});
  };
  onMonthsChange = (months: number[]) => {
    this.props.onValuesChange({months: [...months].sort(sortDateItem)});
  };
  onDaysChange = (days: (number | string)[]) => {
    this.updateDays(days);
  };
  onRangeChange = (e: {target: {checked: boolean}}) => {
    if (e.target.checked) {
      this.props.onValuesChange({range: true});
    } else {
      const copy: Partial<SchedulerConfig> = {...this.props.current};
      delete copy.range;
      this.props.onValuesChange(copy, true);
    }
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
      this.updateDays([]);
      return;
    }
    const days = Array.isArray(this.props.current.days) ? this.props.current.days : [];
    const str = `${dayCount}>${dayType}`;
    if (!days.includes(str)) {
      this.updateDays([...days, str]);
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

    const actualDays = Array.isArray(days) ? days : [];

    for (let i = 1; i <= 31; ++i) {
      if (!row) {
        row = [];
      }
      const pos = actualDays.indexOf(i);
      const onClick =
        pos >= 0
          ? () => {
              this.updateDays(actualDays.toSpliced(pos, 1));
            }
          : () => {
              this.updateDays([...actualDays, i]);
            };
      row.push(
        <td
          key={i}
          className={`ant-picker-cell ant-picker-cell-in-view${pos >= 0 ? ' ant-picker-cell-selected' : ''}`}
          onClick={onClick}
        >
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
      <ConfigProvider.ConfigContext.Consumer>
        {({theme}) => (
          <div
            className={`ticl-e-schedule-days-dropdown ant-picker-dropdown ant-picker-css-var ${typeof theme?.cssVar === 'object' ? theme.cssVar.key : 'css-var-root'}`}
          >
            <div className="ant-picker-date-panel">
              <div className="ant-picker-body">
                <table className="ant-picker-content">
                  <tbody>{rows}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </ConfigProvider.ConfigContext.Consumer>
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
        <div className="ticl-e-property">
          <div className="ticl-e-property-name">{yearsName}</div>
          <div className="ticl-e-property-value">
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
        <div className="ticl-e-property">
          <div className="ticl-e-property-name">{monthsName}</div>
          <div className="ticl-e-property-value">
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
        <div className="ticl-e-property">
          <div className="ticl-e-property-name">{daysName}</div>
          <div className="ticl-e-property-value">
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
          <div className="ticl-e-property">
            <div className="ticl-e-property-name" />
            <div className="ticl-e-property-value">
              <Checkbox checked={Boolean(range)} onChange={this.onRangeChange}>
                <LocalizedPropertyName desc={funcDesc} name="range" />
              </Checkbox>
            </div>
          </div>
        )}
        <div className="ticl-e-property">
          <div className="ticl-e-property-name" />
          <div className="ticl-e-property-value" style={RIGHT_ALIGN_STYLE}>
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
