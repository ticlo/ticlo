import type {ClientConn} from '@ticlo/core';
import type {TicloLayoutContext} from '@ticlo/editor/component/LayoutContext.ts';
import {SchedulePane} from '@ticlo/editor/dock/schedule/SchedulePane.tsx';
import {TextEditorPane} from '@ticlo/editor/dock/text-editor/TextEditorPane.tsx';
import type {DockLayout, SideColumns, TabGroup} from 'rc-dock';

export const sideColumns: SideColumns = {
  left: {collapsible: true, accordion: true, padding: 10},
  right: {collapsible: true, accordion: true, padding: 10},
};

export const leftSideColumns: SideColumns = {left: sideColumns.left};

export const stageGroup: TabGroup = {
  animated: false,
  floatable: true,
  maximizable: true,
};

export const toolGroup: TabGroup = {
  floatable: true,
  maximizable: true,
  newWindow: true,
};

export function createLayoutActions(
  getLayout: () => DockLayout,
  getConn: () => ClientConn
): Pick<TicloLayoutContext, 'editProperty' | 'editSchedule'> {
  return {
    editProperty: (paths, propDesc, defaultValue, mime, readonly, isOptional) => {
      if (!mime) {
        if (propDesc.mime) {
          mime = propDesc.mime;
        } else if (propDesc.type === 'object' || propDesc.type === 'array') {
          mime = 'application/json';
        }
      }
      TextEditorPane.openFloatPanel(getLayout(), getConn(), paths, defaultValue, mime, readonly, isOptional);
    },
    editSchedule: (path, scheduleName, index) => {
      SchedulePane.openFloatPanel(getLayout(), getConn(), path, scheduleName, index);
    },
  };
}
