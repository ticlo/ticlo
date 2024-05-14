import React from 'react';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent';
import {Calendar, Views, luxonLocalizer, Event, SlotInfo, View} from 'ticlo-big-calendar';
import {ClientConn} from '../../core/connect/ClientConn';
import {DateTime} from 'luxon';
import {DockDialogPane} from '../component/DockDialogPane';
import {Select} from 'antd';
import {deepEqual} from '../../core/util/Compare';
import {cacheCall} from '../util/CachedCallback';
import {ScheduleLoader} from './ScheduleLoader';
import {CalendarToolbar} from './CalendarToolbar';

// todo, adjust first day of week based on server side setting
const calendarLocalizer = luxonLocalizer(DateTime);

interface Props {
  conn: ClientConn;
  parentPath: string;
  scheduleName: string;
  index: number;
}

interface State {
  selectedSchedule: string;
  scheduleOptions: {label?: string; value: string}[];
  error?: string;
  timeRange?: [number, number];
}
console.log((Calendar as any).__proto__, (Calendar as any).prototype);
console.log(Object.keys((Calendar as any).__proto__));
export class ScheduleCalendar extends LazyUpdateComponent<Props, State> {
  declare state: State;
  constructor(props: Props) {
    super(props);
    const {parentPath, scheduleName} = props;
    this.state = {scheduleOptions: [{value: scheduleName}], selectedSchedule: scheduleName};
    this.loadOptions(parentPath);
    this.loadEvents(`${parentPath}.${scheduleName}`);
  }
  loadOptions = cacheCall((parentPath: string) => {
    const {conn} = this.props;
    const {scheduleOptions} = this.state;
    conn.query(
      parentPath,
      {'/.*/': {'?filter': {field: '#is', type: '=', value: 'schedule'}}},
      {
        onUpdate: (response) => {
          if (response?.value) {
            const options = Object.keys(response.value)
              .sort()
              .map((value) => ({value}));
            if (!deepEqual(options, scheduleOptions)) {
              this.safeSetState({scheduleOptions: options});
            }
          }
        },
      }
    );
  });
  scheduleLoader: ScheduleLoader;
  loadEvents = cacheCall((schedulePath: string) => {
    let {conn} = this.props;
    this.scheduleLoader?.destroy();
    this.scheduleLoader = new ScheduleLoader(this, conn, schedulePath);
  });
  onSelectSlot = (slot: SlotInfo) => {};
  onRangeChange = (range: {start: Date; end: Date}, view?: View) => {
    this.setState({timeRange: [range.start.getTime(), range.end.getTime()]});
  };
  renderImpl() {
    let {parentPath} = this.props;
    let {error, scheduleOptions, selectedSchedule, timeRange} = this.state;

    this.loadOptions(parentPath);
    this.loadEvents(`${parentPath}.${selectedSchedule}`);
    const events = timeRange ? this.scheduleLoader.getEvents(...timeRange) : [];

    return (
      <div className="ticl-calendar-box">
        <Calendar
          components={{toolbar: CalendarToolbar}}
          localizer={calendarLocalizer}
          culture="zh"
          views={{week: true, month: true}}
          defaultView={Views.WEEK}
          events={events}
          step={30}
          selectable={true}
          onSelectSlot={this.onSelectSlot}
          onSelectEvent={console.log}
          onRangeChange={this.onRangeChange}
        />
        <DockDialogPane error={error}>
          <div className="ticl-clndr-toolbar">
            <Select options={scheduleOptions} value={selectedSchedule} />
          </div>
        </DockDialogPane>
      </div>
    );
  }
  componentWillUnmount() {
    this.scheduleLoader?.destroy();
    super.componentWillUnmount();
  }
}
