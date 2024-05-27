import React from 'react';
import {ClientConn, decode, encode, DataMap, isDataTruncated, translateEditor} from '../../../../src/core/editor';

import {DockLayout} from 'rc-dock';
import {EditorView} from '@codemirror/view';
import {MenuProps} from 'antd/lib/menu';
import {createDockDialog, DockDialogPane} from '../../component/DockDialogPane';
import {ScheduleCalendar} from '../../scheduler/Calendar';

export class SchedulePane {
  static openFloatPanel(layout: DockLayout, conn: ClientConn, parentPath: string, scheduleName: string, index: number) {
    if (!parentPath) {
      // invalid paths
      return;
    }
    let id = `schedule-${parentPath}.${scheduleName}`;
    let title = `${translateEditor('Schedule')} ${parentPath.split('.').at(-1)}`;

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
