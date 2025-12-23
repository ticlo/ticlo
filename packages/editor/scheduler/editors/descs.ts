import type {FunctionDesc, PropDesc} from '@ticlo/core';
import {RepeatModeList} from '@ticlo/core/functions/date/Schedule/SchedulerEvent.js';

// a fake function name that only exist for localization purpose
export const FUNC = 'create-schedule';
export const funcDesc: FunctionDesc = {name: 'create-schedule'};
export const descs: Record<string, PropDesc> = {
  repeat: {name: 'repeat', type: 'select', options: RepeatModeList},
  name: {name: 'name', type: 'string', default: ''},
  key: {name: 'key', type: 'string', default: ''},
  color: {name: 'color', type: 'color'},
  priority: {name: 'priority', type: 'number', min: 0},
  after: {name: 'after', type: 'date'},
  before: {name: 'before', type: 'date'},
  onlyWeekday: {name: 'onlyWeekday', type: 'toggle'},
  // name=days to reuse localization options from advanced days
  wDays: {name: 'days', type: 'multi-select', options: [1, 2, 3, 4, 5, 6, 7]},
  mDays: {
    name: 'mDays',
    type: 'multi-select',
    options: Array.from({length: 31}, (_, i) => i + 1),
  },
};
