// This is a workaround for the issue that react-big-calendar won't report its range on load
// https://github.com/jquense/react-big-calendar/issues/1752

import {Tooltip} from 'antd';
import React from 'react';
import {ToolbarProps, View} from 'ticlo-big-calendar';
import {t} from '../component/LocalizedLabel';
import {Button} from '@blueprintjs/core';
import ButtonRadioGroup from '../component/ButtonRadioGroup';

interface State {}

export class CalendarToolbar extends React.Component<ToolbarProps, State> {
  render() {
    const {view, label} = this.props;
    const capView = view.replace(/^\w/, (s) => s.toUpperCase());
    const viewOptions = [
      {value: 'day', label: t('Day')},
      {value: 'week', label: t('Week')},
      {value: 'month', label: t('Month')},
    ];
    return (
      <div className="ticl-clndr-toolbar">
        <div className="ticl-clndr-toolbar-group">
          <Tooltip title={t(`Previous ${capView}`)}>
            <Button icon="chevron-left" size="small" onClick={this.prev} />
          </Tooltip>
          <Tooltip title={t(`Current ${capView}`)}>
            <Button icon="target" size="small" onClick={this.today} />
          </Tooltip>
          <Tooltip title={t(`Next ${capView}`)}>
            <Button icon="chevron-right" size="small" onClick={this.next} />
          </Tooltip>
        </div>
        <div className="ticl-clndr-toolbar">{label}</div>
        <div className="ticl-clndr-toolbar">
          <ButtonRadioGroup options={viewOptions} value={view} onChange={this.onViewChange} />
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
  onViewChange = (value?: string | number | null) => {
    if (typeof value === 'string') {
      this.props.onView(value as View);
    }
  };

  componentDidMount() {
    // make the Calendar to send an initial onRangeChange update
    this.props.onView(this.props.view);
  }
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
