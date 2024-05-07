import React from 'react';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent';
import {Calendar, Views, luxonLocalizer, Event, SlotInfo} from 'react-big-calendar';
import {ClientConn} from '../../core/connect/ClientConn';
import {DateTime} from 'luxon';
import {DockDialogPane} from '../component/DockDialogPane';
import {Select} from 'antd';

// todo, adjust first day of week based on server side setting
const calendarLocalizer = luxonLocalizer(DateTime);

const messages = {
  previous: '上一周',
  next: '下一周',
  today: '现在',
};

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
}

export class ScheduleCalendar extends LazyUpdateComponent<Props, State> {
  declare state: State;
  constructor(props: Props) {
    super(props);
    this.state = {scheduleOptions: [{value: props.scheduleName}], selectedSchedule: props.scheduleName};
  }
  onSelectSlot = (slot: SlotInfo) => {};
  renderImpl() {
    let {parentPath} = this.props;
    let {error, scheduleOptions, selectedSchedule} = this.state;
    return (
      <div className="ticl-calendar-box">
        <Calendar
          localizer={calendarLocalizer}
          culture="zh"
          messages={messages}
          views={{week: true, month: true}}
          defaultView={Views.WEEK}
          events={[]}
          step={30}
          selectable={true}
          onSelectSlot={this.onSelectSlot}
          onSelectEvent={console.log}
        />
        <DockDialogPane error={error}>
          <Select options={scheduleOptions} value={selectedSchedule} />
        </DockDialogPane>
      </div>
    );
  }
}
