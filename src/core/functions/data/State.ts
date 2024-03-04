import {BlockFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';
import {Block} from '../../block/Block';
import {isDataMap, isPrimitiveType} from '../../util/DataTypes';
import {Resolver} from '../../block/Resolver';

export class StateFunction extends BlockFunction {
  writeState() {
    if (!this._data) {
      // _data is null when function is destroyed
      return;
    }
    let savable = this._data.getValue('savable');
    let states = this._data.getArray('', 1, ['input', 'target']);
    let len = states.length;
    for (let i = 0; i < len; ++i) {
      const state = states[i];
      if (isDataMap(state)) {
        let {input, target} = state;
        if (!Object.is(input, target)) {
          let inputProp = this._data.getProperty(`input${i}`);
          let sourceProp = inputProp?._bindingSource?.getProperty();
          if (sourceProp) {
            if (savable) {
              sourceProp.setValue(target);
            } else {
              sourceProp.updateValue(target);
            }
          }
        }
      }
    }
  }

  run() {
    let isAsync = this._data.getValue('async');
    if (isAsync) {
      return new Promise((resolve) => {
        Resolver.callLater(() => {
          this.writeState();
          resolve(undefined);
        });
      });
    } else {
      this.writeState();
    }
  }
}

const API = {
  commands: {
    saveSnapshot: (block: Block, params: {[key: string]: any}) => {
      let property = params?.property;
      let states = block.getArray('', 1, ['input', 'target']);
      let len = states.length;
      for (let i = 0; i < len; ++i) {
        const state = states[i];
        if (isDataMap(state)) {
          let {input, target} = state;
          if (input !== target && isPrimitiveType(input)) {
            block.setValue(`target${i}`, input);
          }
        }
      }
    },
  },
};

Functions.add(
  StateFunction,
  {
    name: 'set-state',
    icon: 'fas:code-branch',
    mode: 'onCall',
    priority: 1,
    properties: [
      {
        name: '',
        type: 'group',
        defaultLen: 1,
        properties: [
          {name: 'input', type: 'any', pinned: true},
          {name: 'target', type: 'any', pinned: true},
        ],
      },
      {name: 'savable', type: 'toggle'},
      {name: 'async', type: 'toggle'},
    ],
    commands: {
      saveSnapshot: {parameters: []},
    },
    category: 'data',
    color: '1bb',
  },
  undefined,
  API
);
