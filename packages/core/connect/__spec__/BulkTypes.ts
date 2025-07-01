import {PureFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';

class TestFunction extends PureFunction {
  run() {}
}

TestFunction.prototype.priority = 0;

let testDesc = {
  name: '',
  icon: 'fas:plus',
  properties: [
    {name: 'a', type: 'number', pinned: true},
    {name: 'b', type: 'number', pinned: true},
    {name: 'c', type: 'number', pinned: true},
    {name: 'd', type: 'number', pinned: true},
    {name: '#output', pinned: true, type: 'number', readonly: true},
  ],
};

export function addTestTypes(prefix: string, count: number) {
  for (let i = 0; i < count; ++i) {
    Functions.add(TestFunction, {...testDesc, name: `${prefix}${i}`} as any);
  }
}

export function removeTestTypes(prefix: string, count: number) {
  for (let i = 0; i < count; ++i) {
    Functions.clear(`${prefix}${i}`);
  }
}
