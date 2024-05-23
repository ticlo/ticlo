import React from 'react';
import {DateTime} from 'luxon';
import {EyeFilled, EyeInvisibleOutlined} from '@ant-design/icons';
import {Button, Select} from 'antd';
import {Calendar, Views, luxonLocalizer, Event, SlotInfo, View, EventCell} from 'ticlo-big-calendar';
import {ClientConn} from '../../core/connect/ClientConn';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent';
import {deepEqual} from '../../core/util/Compare';
import {cacheCall} from '../util/CachedCallback';
import {CalendarEvent, ScheduleLoader} from './ScheduleLoader';
import {CalendarToolbar} from './CalendarToolbar';
import {CalendarEventEditor} from './CalendarEventEditor';
import {SchedulerConfig} from '../../core/functions/date/Schedule/SchedulerEvent';

const CalendarT = Calendar<CalendarEvent>;

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

  timeRange?: [number, number];
  selectedId?: string;
  selectedIdx?: number;
}
export class ScheduleCalendar extends LazyUpdateComponent<Props, State> {
  declare state: State;
  constructor(props: Props) {
    super(props);
    const {parentPath, scheduleName, index} = props;
    this.state = {scheduleOptions: [{value: scheduleName}], selectedSchedule: scheduleName, selectedIdx: index};
    this.loadOptions(parentPath);
    this.loadEvents(`${parentPath}.${scheduleName}`);
  }
  loadOptions = cacheCall((parentPath: string) => {
    const {conn} = this.props;
    const {scheduleOptions} = this.state;
    conn.query(
      parentPath,
      {'/.*/': {'?filter': {field: '#is', type: '=', value: 'scheduler'}}},
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
  onSelectSlot = (slot: SlotInfo) => {
    console.log(slot);
  };
  onSelectEvent = (event: CalendarEvent) => {
    this.safeSetState({selectedId: event.id});
    this.safeSetState({selectedIdx: parseInt(event.id.split('-')[0])});
  };
  onRangeChange = (range: {start: Date; end: Date}, view?: View) => {
    this.setState({timeRange: [range.start.getTime(), range.end.getTime()]});
  };
  eventPropGetter = (event: CalendarEvent, start: Date, end: Date, isSelected: boolean) => {
    const {selectedIdx, selectedId} = this.state;
    const className: string = selectedId == null && selectedIdx === event.parent.idx ? 'rbc-selected' : undefined;
    return {className, style: event.parent.style};
  };

  getEventList(dummyEvents: CalendarEvent[]) {
    const calendarContext = this._calendar?.state?.context;
    if (!calendarContext) {
      return null;
    }
    const {viewNames, ...otherContext} = calendarContext;
    const {selectedIdx} = this.state;

    return dummyEvents.map((event) => (
      <div className="ticl-schedule-row" key={event.id}>
        <Button
          className="ticl-icon-btn"
          shape="circle"
          icon={event.parent.visible ? <EyeFilled /> : <EyeInvisibleOutlined />}
          onClick={() => event.parent.toggleVisible()}
        />
        <EventCell
          event={event}
          selected={event.parent.idx === selectedIdx}
          onSelect={() => this.safeSetState({selectedIdx: event.parent.idx, selectedId: null})}
          {...otherContext}
        />
      </div>
    ));
  }

  updateConfig = (config: SchedulerConfig) => {
    const {conn, parentPath} = this.props;
    const {selectedSchedule, selectedIdx} = this.state;
    conn.setValue(`${parentPath}.${selectedSchedule}.config${selectedIdx}`, config);
  };

  _calendar: {state: {context: any}};
  getCalendarRef = (c: any) => (this._calendar = c);

  renderImpl() {
    let {parentPath, conn} = this.props;
    let {scheduleOptions, selectedSchedule, timeRange, selectedId, selectedIdx} = this.state;

    const schedulePath = `${parentPath}.${selectedSchedule}`;
    this.loadOptions(parentPath);
    this.loadEvents(schedulePath);
    const dummyEvents = this.scheduleLoader.getDummyEvents();
    const events = timeRange ? this.scheduleLoader.getEvents(...timeRange) : [];

    const selectedEvent = selectedId ? events?.find((e) => e.id === selectedId) : null;

    return (
      <div className="ticl-calendar-box">
        <CalendarT
          ref={this.getCalendarRef}
          components={{toolbar: CalendarToolbar}}
          localizer={calendarLocalizer}
          culture="zh"
          views={{day: true, week: true, month: true}}
          defaultView={Views.WEEK}
          eventPropGetter={this.eventPropGetter}
          events={events}
          showMultiDayTimes={true}
          step={30}
          selectable={true}
          popup={true}
          selected={selectedEvent}
          onSelectSlot={this.onSelectSlot}
          onSelectEvent={this.onSelectEvent}
          onRangeChange={this.onRangeChange}
        />

        <div className="ticl-schedule-side">
          <div className="ticl-schedule-head">
            <Select
              options={scheduleOptions}
              value={selectedSchedule}
              onChange={(value) => this.setState({selectedSchedule: value})}
            />
          </div>
          <div className="ticl-schedule-list">{this.getEventList(dummyEvents)}</div>
          <CalendarEventEditor
            conn={conn}
            path={schedulePath}
            index={selectedIdx}
            config={dummyEvents[selectedIdx]?.parent.config}
            onChange={this.updateConfig}
          />
        </div>
      </div>
    );
  }

  componentWillUnmount() {
    this.scheduleLoader?.destroy();
    super.componentWillUnmount();
  }
}
