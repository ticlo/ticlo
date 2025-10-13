// This is a workaround for the issue that react-big-calendar won't report its range on load
// https://github.com/jquense/react-big-calendar/issues/1752

import {Radio, Tooltip} from 'antd';
import React from 'react';
import {ToolbarProps, View} from 'ticlo-big-calendar';
import {t} from '../component/LocalizedLabel';
import {Icon} from '@blueprintjs/core';

interface State {}

export class CalendarToolbar extends React.Component<ToolbarProps, State> {
  render() {
    const {view, label} = this.props;
    const capView = view.replace(/^\w/, (s) => s.toUpperCase());
    return (
      <div className="ticl-clndr-toolbar">
        <div className="ticl-clndr-toolbar-group">
          <Tooltip title={t(`Previous ${capView}`)}>
            <Radio.Button onClick={this.prev}>
              <Icon icon="chevron-left" />
            </Radio.Button>
          </Tooltip>
          <Tooltip title={t(`Current ${capView}`)}>
            <Radio.Button onClick={this.today}>
              <Icon icon="target" />
            </Radio.Button>
          </Tooltip>
          <Tooltip title={t(`Next ${capView}`)}>
            <Radio.Button onClick={this.next}>
              <Icon icon="chevron-right" />
            </Radio.Button>
          </Tooltip>
        </div>
        <div className="ticl-clndr-toolbar">{label}</div>
        <div className="ticl-clndr-toolbar">
          <Radio.Group value={view} buttonStyle="solid">
            <Radio.Button value="day" onClick={this.day}>
              {t('Day')}
            </Radio.Button>
            <Radio.Button value="week" onClick={this.week}>
              {t('Week')}
            </Radio.Button>
            <Radio.Button value="month" onClick={this.month}>
              {t('Month')}
            </Radio.Button>
          </Radio.Group>
        </div>
      </div>
    );
  }

  prev = () => {
    this.props.onNavigate('PREV');
  };
  next = () => {
    this.props.onNavigate('NEXT');
  };
  today = () => {
    this.props.onNavigate('TODAY');
  };
  day = () => {
    this.props.onView('day');
  };
  week = () => {
    this.props.onView('week');
  };
  month = () => {
    this.props.onView('month');
  };

  componentDidMount() {
    // make the Calendar to send an initial onRangeChange update
    this.props.onView(this.props.view);
  }

  view = (view: View) => {
    this.props.onView(view);
  };
}

// keep these comments so collect-editor-en script can find these translation key
// t('Previous Day')
// t('Current Day')
// t('Next Day')
// t('Previous Week')
// t('Current Week')
// t('Next Week')
// t('Previous Month')
// t('Current Month')
// t('Next Month')
