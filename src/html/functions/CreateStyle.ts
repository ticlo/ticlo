import {BaseFunction, Functions, PropDesc, PropGroupDesc} from '../../../src/core';
import StyleDef from './StyleDef';

export class CreateStyleFunction extends BaseFunction {
  run() {
    let spread = this._data.getValue('#spread');
    let output = spread ? {...spread} : {};
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
    properties: [
      {name: '#spread', type: 'object'},
      {name: '#output', type: 'object', readonly: true}
    ]
  },
  'html'
);
