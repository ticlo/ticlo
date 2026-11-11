import {BaseFunction, globalFunctions, NO_EMIT} from '@ticlo/core';

class EnvFunction extends BaseFunction {
  run() {
    const name = this._data.getValue('name');
    this._data.output(typeof name === 'string' && Object.hasOwn(process.env, name) ? process.env[name] : undefined);
    return NO_EMIT;
  }

  cleanup() {
    this._data.output(undefined);
  }
}

globalFunctions.addCategory({
  id: 'node',
  name: 'node',
  libraryId: 'node',
  icon: '11:ENV',
  color: '4af',
});
globalFunctions.addFactory(
  EnvFunction,
  {
    name: 'env',
    icon: '11:ENV',
    mode: 'onLoad',
    priority: 0,
    properties: [
      {name: 'name', type: 'string', pinned: true},
      {name: '#output', type: 'string', readonly: true, pinned: true},
    ],
  },
  'node'
);
