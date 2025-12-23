import {JsFunction} from '@ticlo/core/functions/script/Js.js';

JsFunction.registerType(
  'this["out1"] = this["in1"]',
  {
    name: 'Js-type1',
    priority: 1,
    mode: 'onCall',
    properties: [
      {name: 'in1', type: 'string'},
      {name: 'out1', type: 'string', readonly: true},
    ],
  },
  'testns'
);
