import {Functions} from '../../block/Functions';
import {PureFunction} from '../../block/BlockFunction';
import {FunctionDesc} from '../../block/Descriptor';

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

export class NotFunction extends PureFunction {
  run(): any {
    let v0 = this._data.getValue('input');
    this._data.output(!Boolean(v0));
  }
}

Functions.add(NotFunction, {
  ...descriptor,
  name: 'not',
  icon: 'txt:!',
  properties: [
    {name: 'input', type: 'toggle', pinned: true},
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
  recipient: 'input',
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
