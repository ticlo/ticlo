import {Functions} from '../../block/Functions.js';
import {PureFunction} from '../../block/BlockFunction.js';
import {FunctionDesc} from '../../block/Descriptor.js';

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
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    this._data.output(v0 === v1);
  }
}

Functions.add(EqualFunction, {
  ...descriptor,
  name: 'equal',
  icon: 'fas:equals',
  properties: [
    {name: '0', type: 'any', pinned: true},
    {name: '1', type: 'any', pinned: true},
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
});

export class NotEqualFunction extends PureFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    this._data.output(v0 !== v1);
  }
}

Functions.add(NotEqualFunction, {
  ...descriptor,
  name: 'not-equal',
  icon: 'fas:not-equal',
  properties: [
    {name: '0', type: 'any', pinned: true},
    {name: '1', type: 'any', pinned: true},
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
});

export class GreaterThanFunction extends PureFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(v0 > v1);
    }
  }
}

Functions.add(GreaterThanFunction, {
  ...descriptor,
  name: 'greater-than',
  icon: 'fas:greater-than',
});

export class LessThanFunction extends PureFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(v0 < v1);
    }
  }
}

Functions.add(LessThanFunction, {
  ...descriptor,
  name: 'less-than',
  icon: 'fas:less-than',
});

export class GreaterEqualFunction extends PureFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(v0 >= v1);
    }
  }
}

Functions.add(GreaterEqualFunction, {
  ...descriptor,
  name: 'greater-equal',
  icon: 'fas:greater-than-equal',
});

export class LessEqualFunction extends PureFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(v0 <= v1);
    }
  }
}

Functions.add(LessEqualFunction, {
  ...descriptor,
  name: 'less-equal',
  icon: 'fas:less-than-equal',
});

export class WithinRangeFunction extends PureFunction {
  run(): any {
    let input = this._data.getValue('input');
    let min = this._data.getValue('min');
    let max = this._data.getValue('max');
    if (input == null || min == null || max == null) {
      this._data.output(undefined);
    } else {
      this._data.output(input >= min && input <= max);
    }
  }
}

Functions.add(WithinRangeFunction, {
  ...descriptor,
  name: 'within-range',
  icon: 'txt:[,]',
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
    let input = this._data.getValue('input');
    let min = this._data.getValue('min');
    let max = this._data.getValue('max');
    if (input == null || min == null || max == null) {
      this._data.output(undefined);
    } else {
      this._data.output(input >= min && input < max);
    }
  }
}

Functions.add(WithinIntervalFunction, {
  ...descriptor,
  name: 'within-interval',
  icon: 'txt:[,)',
  properties: [
    {name: 'input', type: 'number', pinned: true},
    {name: 'min', type: 'number', pinned: true},
    {name: 'max', type: 'number', pinned: true},
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
  recipient: 'input',
});
