import React from 'react';
import {ClientConn, translateEditor} from '@ticlo/core/editor.ts';

import {DockLayout} from 'rc-dock';
import {createDockDialog} from '../../component/DockDialogPane.tsx';
import {ScheduleCalendar} from '../../scheduler/Calendar.tsx';

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
      {preferredWidth: 1440, preferredHeight: 960}
    );
  }
}
