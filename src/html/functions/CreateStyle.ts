import {BaseFunction, Functions, PropDesc, PropGroupDesc} from '../../../src/core';
import StyleDef from './StyleDef';
import {BlockConfig} from '../../core/block/BlockProperty';

export class CreateStyleFunction extends BaseFunction {
  configChanged(config: BlockConfig, val: any): boolean {
    switch (config._name) {
      case '#more':
      case '#optional':
        return true;
      default:
        return false;
    }
  }
  run() {
    let baseObj = this._data.getValue('#extend');
    let output = baseObj ? {...baseObj} : {};
    for (let field of this._data.getOptionalProps()) {
      let value = this._data.getValue(field);
      if (value !== undefined) {
        output[field] = value;
      }
    }
    this._data.output(output);
  }
}

Functions.add(
  CreateStyleFunction,
  {
    name: 'create-style',
    icon: 'fab:css3',
    optional: StyleDef,
    properties: [{name: '#output', type: 'object', readonly: true}],
    configs: [{name: '#extend', type: 'object'}, '#call', '#mode', '#priority', '#sync']
  },
  'html'
);
