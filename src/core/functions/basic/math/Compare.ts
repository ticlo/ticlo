import {Types} from '../../../block/Type';
import {BaseFunction, FunctionData} from '../../../block/BlockFunction';
import {FunctionDesc} from '../../../block/Descriptor';

const descriptor: FunctionDesc = {
  name: '',
  icon: '',
  recipient: '0',
  category: 'compare',
  properties: [
    {name: '0', type: 'number', visible: 'high'},
    {name: '1', type: 'number', visible: 'high'},
    {name: 'output', type: 'toggle', readonly: true}
  ]
};

export class EqualFunction extends BaseFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    this._data.output(v0 === v1);
  }
}

Types.add(EqualFunction, {
  ...descriptor,
  name: 'equal',
  icon: 'fas:equals',
  order: 0,
  properties: [
    {name: '0', type: 'any', visible: 'high'},
    {name: '1', type: 'any', visible: 'high'},
    {name: 'output', type: 'toggle', readonly: true}
  ]
});

export class NotEqualFunction extends BaseFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    this._data.output(v0 !== v1);
  }
}

Types.add(NotEqualFunction, {
  ...descriptor,
  name: 'not-equal',
  icon: 'fas:not-equal',
  properties: [
    {name: '0', type: 'any', visible: 'high'},
    {name: '1', type: 'any', visible: 'high'},
    {name: 'output', type: 'toggle', readonly: true}
  ]
});

export class NotFunction extends BaseFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    this._data.output(!Boolean(v0));
  }
}

Types.add(NotFunction, {
  ...descriptor,
  name: 'not',
  icon: 'txt:!',
  properties: [
    {name: '0', type: 'toggle', visible: 'high'},
    {name: 'output', type: 'toggle', readonly: true}
  ]
});

export class GreaterThanFunction extends BaseFunction {
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

Types.add(GreaterThanFunction, {
  ...descriptor,
  name: 'greater-than',
  icon: 'fas:greater-than'
});

export class LessThanFunction extends BaseFunction {
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

Types.add(LessThanFunction, {
  ...descriptor,
  name: 'less-than',
  icon: 'fas:less-than'
});

export class GreaterEqualFunction extends BaseFunction {
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

Types.add(GreaterEqualFunction, {
  ...descriptor,
  name: 'greater-equal',
  icon: 'fas:greater-than-equal'
});

export class LessEqualFunction extends BaseFunction {
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

Types.add(LessEqualFunction, {
  ...descriptor,
  name: 'less-equal',
  icon: 'fas:less-than-equal'
});
