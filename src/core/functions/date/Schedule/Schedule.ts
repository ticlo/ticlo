import {BlockFunction} from '../../../block/BlockFunction';
import {Functions} from '../../../block/Functions';

export class ScheduleFunction extends BlockFunction {
  run(): unknown {
    return undefined;
  }
}

Functions.add(ScheduleFunction, {
  name: 'schedule',
  icon: 'fas:calendar',
  priority: 1,
  properties: [
    {
      name: '',
      type: 'group',
      defaultLen: 0,
      properties: [
        {name: 'config', type: 'object', pinned: true},
        {name: 'value', type: 'any', pinned: true},
      ],
    },
    {name: 'default', type: 'any'},
    {name: 'timezone', type: 'string', default: ''},
    {name: '#output', type: 'any', readonly: true, pinned: true},
  ],
  category: 'date',
});
