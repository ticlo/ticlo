import type {ClientConn} from '@ticlo/core';
import {createElement} from 'react';
import type {ProjectFiles} from '@ticlo/core/storage/FileAccess.ts';
import type {TicloLayoutContext} from '@ticlo/editor/component/LayoutContext.ts';
import {StagePanelFocus} from '@ticlo/editor/dock/StagePanelFocus.tsx';
import {SchedulePane} from '@ticlo/editor/dock/schedule/SchedulePane.tsx';
import {TextEditorPane} from '@ticlo/editor/dock/text-editor/TextEditorPane.tsx';
import type {DockLayout, SideColumns, TabGroup} from 'rc-dock';

export function stageReadonly(storage: ProjectFiles | undefined, path: string) {
  if (!storage || path === '#temp' || path.startsWith('#temp.')) return false;
  if (path === '#global' || path.startsWith('#global.')) return !storage.user.getCapabilities('#global.ticlo').write;
  return !storage.getCapabilities(path.startsWith('+') ? path.slice(1).split(/[.:]/)[0] : '#root').write;
}

export const sideColumns: SideColumns = {
  left: {collapsible: true, accordion: true, padding: 4},
  right: {collapsible: true, accordion: true, padding: 4},
};

export const leftSideColumns: SideColumns = {left: sideColumns.left};

export const stageGroup: TabGroup = {
  animated: false,
  floatable: true,
  maximizable: true,
  panelExtra: (panel) => createElement(StagePanelFocus, {panel}),
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
    editProperty: (paths, propDesc, defaultValue, mime, readonly) => {
      if (!mime) {
        if (propDesc.mime) {
          mime = propDesc.mime;
        } else if (propDesc.type === 'object' || propDesc.type === 'array') {
          mime = 'application/json';
        }
      }
      TextEditorPane.openFloatPanel(getLayout(), getConn(), paths, defaultValue, mime, readonly);
    },
    editSchedule: (path, scheduleName, index) => {
      SchedulePane.openFloatPanel(getLayout(), getConn(), path, scheduleName, index);
    },
  };
}
