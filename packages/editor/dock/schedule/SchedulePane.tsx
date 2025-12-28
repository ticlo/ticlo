import React from 'react';
import {ClientConn, decode, encode, DataMap, isDataTruncated, translateEditor} from '@ticlo/core/editor.js';

import {DockLayout} from 'rc-dock';
import {EditorView} from '@codemirror/view';
import {MenuProps} from 'antd';
import {createDockDialog, DockDialogPane} from '../../component/DockDialogPane.js';
import {ScheduleCalendar} from '../../scheduler/Calendar.js';

export class SchedulePane {
  static openFloatPanel(layout: DockLayout, conn: ClientConn, parentPath: string, scheduleName: string, index: number) {
    if (!parentPath) {
      // invalid paths
      return;
    }
    const id = `schedule-${parentPath}.${scheduleName}`;
    const title = `${translateEditor('Schedule')} ${parentPath.split('.').at(-1)}`;

    createDockDialog(
      layout,
      title,
      <ScheduleCalendar conn={conn} parentPath={parentPath} scheduleName={scheduleName} index={index} />,
      id,
      {
        preferredWidth: 1440,
        preferredHeight: 960,
      }
    );
  }
}
