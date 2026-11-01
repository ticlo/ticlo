import {globalFunctions} from '../../block/FunctionLib.ts';
import {PureFunction} from '../../block/BlockFunction.ts';
import {FunctionDesc} from '../../block/Descriptor.ts';

const descriptor: FunctionDesc = {
  name: '',
  icon: '',
  recipient: '0',
  category: 'compare',
  properties: [
    {name: '0', type: 'number', pinned: true},
    {name: '1', type: 'number', pinned: true},
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
};

export class EqualFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('0');
    const v1 = this._data.getValue('1');
    this._data.output(v0 === v1);
  }
}

globalFunctions.addFactory(EqualFunction, {
  ...descriptor,
  name: 'equal',
  icon: '23:=',
  properties: [
    {name: '0', type: 'any', pinned: true},
    {name: '1', type: 'any', pinned: true},
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
});

export class NotEqualFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('0');
    const v1 = this._data.getValue('1');
    this._data.output(v0 !== v1);
  }
}

globalFunctions.addFactory(NotEqualFunction, {
  ...descriptor,
  name: 'not-equal',
  icon: '23:=  :/',
  properties: [
    {name: '0', type: 'any', pinned: true},
    {name: '1', type: 'any', pinned: true},
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
});

export class GreaterThanFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('0');
    const v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(v0 > v1);
    }
  }
}

globalFunctions.addFactory(GreaterThanFunction, {
  ...descriptor,
  name: 'greater-than',
  icon: '^:>',
});

export class LessThanFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('0');
    const v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(v0 < v1);
    }
  }
}

globalFunctions.addFactory(LessThanFunction, {
  ...descriptor,
  name: 'less-than',
  icon: '^:<',
});

export class GreaterEqualFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('0');
    const v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(v0 >= v1);
    }
  }
}

globalFunctions.addFactory(GreaterEqualFunction, {
  ...descriptor,
  name: 'greater-equal',
  icon: '^:⩾',
});

export class LessEqualFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('0');
    const v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(v0 <= v1);
    }
  }
}

globalFunctions.addFactory(LessEqualFunction, {
  ...descriptor,
  name: 'less-equal',
  icon: '^:⩽',
});

export class WithinRangeFunction extends PureFunction {
  run(): any {
    const input = this._data.getValue('input');
    const min = this._data.getValue('min');
    const max = this._data.getValue('max');
    if (input == null || min == null || max == null) {
      this._data.output(undefined);
    } else {
      this._data.output(input >= min && input <= max);
    }
  }
}

globalFunctions.addFactory(WithinRangeFunction, {
  ...descriptor,
  name: 'within-range',
  icon: '^:[,]',
  properties: [
    {name: 'input', type: 'number', pinned: true},
    {name: 'min', type: 'number', pinned: true},
    {name: 'max', type: 'number', pinned: true},
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
  recipient: 'input',
});

export class WithinIntervalFunction extends PureFunction {
  run(): any {
    const input = this._data.getValue('input');
    const min = this._data.getValue('min');
    const max = this._data.getValue('max');
    if (input == null || min == null || max == null) {
      this._data.output(undefined);
    } else {
      this._data.output(input >= min && input < max);
    }
  }
}

globalFunctions.addFactory(WithinIntervalFunction, {
  ...descriptor,
  name: 'within-interval',
  icon: '^:[,)',
  properties: [
    {name: 'input', type: 'number', pinned: true},
    {name: 'min', type: 'number', pinned: true},
    {name: 'max', type: 'number', pinned: true},
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
  recipient: 'input',
});
