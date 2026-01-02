import {globalFunctions} from '../../block/Functions.js';
import {PureFunction} from '../../block/BlockFunction.js';
import {getInputsArray} from '../../block/FunctonData.js';

export class AndFunction extends PureFunction {
  run(): any {
    for (const val of getInputsArray(this._data)) {
      if (!val) {
        this._data.output(false);
        return;
      }
    }
    this._data.output(true);
  }
}

globalFunctions.add(AndFunction, {
  name: 'and',
  icon: 'txt:and',
  properties: [
    {
      name: '',
      type: 'group',
      defaultLen: 2,
      properties: [{name: '', type: 'any', pinned: true}],
    },
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
  recipient: '0',
  category: 'math',
});

export class OrFunction extends PureFunction {
  run(): any {
    for (const val of getInputsArray(this._data)) {
      if (val) {
        this._data.output(val);
        return;
      }
    }
    this._data.output(undefined);
  }
}

globalFunctions.add(OrFunction, {
  name: 'or',
  icon: 'txt:or',
  properties: [
    {
      name: '',
      type: 'group',
      defaultLen: 2,
      properties: [{name: '', type: 'any', pinned: true}],
    },
    {name: '#output', pinned: true, type: 'any', readonly: true},
  ],
  recipient: '0',
  category: 'math',
});

export class XorFunction extends PureFunction {
  run(): any {
    let count = 0;
    for (const val of getInputsArray(this._data)) {
      if (val) {
        ++count;
      }
    }
    // return true when odd number of inputs is true
    this._data.output((count & 1) === 1);
  }
}

globalFunctions.add(XorFunction, {
  name: 'xor',
  icon: 'txt:xor',
  properties: [
    {
      name: '',
      type: 'group',
      defaultLen: 2,
      properties: [{name: '', type: 'any', pinned: true}],
    },
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
  recipient: '0',
  category: 'math',
});

export class NotFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('input');
    this._data.output(!v0);
  }
}

globalFunctions.add(NotFunction, {
  name: 'not',
  icon: 'txt:!',
  properties: [
    {name: 'input', type: 'toggle', pinned: true},
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
  recipient: 'input',
  category: 'math',
});
