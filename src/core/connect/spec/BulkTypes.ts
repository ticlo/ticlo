import {BaseFunction} from '../../block/BlockFunction';
import {Types} from '../../block/Type';

class TestFunction extends BaseFunction {}

TestFunction.prototype.priority = 0;
TestFunction.prototype.useLength = false;

let testDesc = {
  name: '',
  icon: 'fas:plus',
  useLength: true,
  properties: [
    {name: 'a', type: 'number', visible: 'high'},
    {name: 'b', type: 'number', visible: 'high'},
    {name: 'c', type: 'number', visible: 'high'},
    {name: 'd', type: 'number', visible: 'high'},
    {name: 'output', type: 'number', readonly: true}
  ]
};

export function addTestTypes(prefix: string, count: number) {
  for (let i = 0; i < count; ++i) {
    Types.add(TestFunction, {...testDesc, name: `${prefix}${i}`} as any);
  }
}

export function removeTestTypes(prefix: string, count: number) {
  for (let i = 0; i < count; ++i) {
    Types.clear(`${prefix}${i}`);
  }
}
