import {globalFunctions} from '../../block/FunctionLib.js';
import {PureFunction} from '../../block/BlockFunction.js';
import {FunctionDesc} from '../../block/Descriptor.js';
import {getInputsArray} from '../../block/FunctonData.js';

const descriptorN: FunctionDesc = {
  name: '',
  icon: '',
  properties: [
    {
      name: '',
      type: 'group',
      defaultLen: 2,
      properties: [{name: '', type: 'number', pinned: true}],
    },
    {name: '#output', pinned: true, type: 'number', readonly: true},
  ],
  recipient: '0',
  tags: ['math', 'math-n'],
  category: 'math',
};
const descriptor2: FunctionDesc = {
  name: '',
  icon: '',
  properties: [
    {name: '0', type: 'number', pinned: true},
    {name: '1', type: 'number', pinned: true},
    {name: '#output', pinned: true, type: 'number', readonly: true},
  ],
  recipient: '0',
  tags: ['math', 'math-2'],
  category: 'math',
};
const descriptor1: FunctionDesc = {
  name: '',
  icon: '',
  properties: [
    {name: 'input', type: 'number', pinned: true},
    {name: '#output', pinned: true, type: 'number', readonly: true},
  ],
  recipient: 'input',
  tags: ['math', 'math-1'],
  category: 'math',
};

export class AddFunction extends PureFunction {
  run(): any {
    let sum = 0;
    for (const val of getInputsArray(this._data)) {
      if (val == null) {
        this._data.output(undefined);
        return;
      }
      sum += Number(val);
    }
    this._data.output(sum);
  }
}

globalFunctions.addFactory(AddFunction, {
  ...descriptorN,
  name: 'add',
  icon: 'fas:plus',
});

export class MultiplyFunction extends PureFunction {
  run(): any {
    let product = 1;
    for (const val of getInputsArray(this._data)) {
      if (val == null) {
        this._data.output(undefined);
        return;
      }
      product *= Number(val);
    }
    this._data.output(product);
  }
}

globalFunctions.addFactory(MultiplyFunction, {
  ...descriptorN,
  name: 'multiply',
  icon: 'fas:xmark',
});

export class SubtractFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('0');
    const v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(Number(v0) - Number(v1));
    }
  }
}

globalFunctions.addFactory(SubtractFunction, {
  ...descriptor2,
  name: 'subtract',
  icon: 'fas:minus',
});

export class DivideFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('0');
    const v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(Number(v0) / Number(v1));
    }
  }
}

globalFunctions.addFactory(DivideFunction, {
  ...descriptor2,
  name: 'divide',
  icon: 'fas:divide',
});

export class ModuloFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('0');
    const v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(Number(v0) % Number(v1));
    }
  }
}

globalFunctions.addFactory(ModuloFunction, {
  ...descriptor2,
  name: 'modulo',
  icon: 'txt:%',
});

export class PowerFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('0');
    const v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(Number(v0) ** Number(v1));
    }
  }
}

globalFunctions.addFactory(PowerFunction, {
  ...descriptor2,
  name: 'power',
  icon: 'txt:x^',
});

export class RoundFunction extends PureFunction {
  run(): any {
    const input = this._data.getValue('input');
    this._data.output(input == null ? undefined : Math.round(Number(input)));
  }
}

globalFunctions.addFactory(RoundFunction, {
  ...descriptor1,
  name: 'round',
  icon: 'txt:~',
});

export class FloorFunction extends PureFunction {
  run(): any {
    const input = this._data.getValue('input');
    this._data.output(input == null ? undefined : Math.floor(Number(input)));
  }
}

globalFunctions.addFactory(FloorFunction, {
  ...descriptor1,
  name: 'floor',
  icon: 'txt:[~',
});

export class CeilFunction extends PureFunction {
  run(): any {
    const input = this._data.getValue('input');
    this._data.output(input == null ? undefined : Math.ceil(Number(input)));
  }
}

globalFunctions.addFactory(CeilFunction, {
  ...descriptor1,
  name: 'ceil',
  icon: 'txt:~]',
});

export class AbsFunction extends PureFunction {
  run(): any {
    const input = this._data.getValue('input');
    this._data.output(input == null ? undefined : Math.abs(Number(input)));
  }
}

globalFunctions.addFactory(AbsFunction, {
  ...descriptor1,
  name: 'abs',
  icon: 'txt:|x|',
});

export class ClampFunction extends PureFunction {
  run(): any {
    const input = this._data.getValue('input');
    const min = this._data.getValue('min');
    const max = this._data.getValue('max');
    if (input == null || min == null || max == null) {
      this._data.output(undefined);
    } else {
      this._data.output(Math.min(Math.max(Number(input), Number(min)), Number(max)));
    }
  }
}

globalFunctions.addFactory(ClampFunction, {
  name: 'clamp',
  icon: 'txt:[x]',
  properties: [
    {name: 'input', type: 'number', pinned: true},
    {name: 'min', type: 'number', pinned: true},
    {name: 'max', type: 'number', pinned: true},
    {name: '#output', pinned: true, type: 'number', readonly: true},
  ],
  recipient: 'input',
  tags: ['math'],
  category: 'math',
});

export class MinFunction extends PureFunction {
  run(): any {
    let result = Infinity;
    let hasValue = false;
    for (const val of getInputsArray(this._data)) {
      if (val == null) {
        this._data.output(undefined);
        return;
      }
      result = Math.min(result, Number(val));
      hasValue = true;
    }
    this._data.output(hasValue ? result : undefined);
  }
}

globalFunctions.addFactory(MinFunction, {
  ...descriptorN,
  name: 'min',
  icon: 'txt:min',
});

export class MaxFunction extends PureFunction {
  run(): any {
    let result = -Infinity;
    let hasValue = false;
    for (const val of getInputsArray(this._data)) {
      if (val == null) {
        this._data.output(undefined);
        return;
      }
      result = Math.max(result, Number(val));
      hasValue = true;
    }
    this._data.output(hasValue ? result : undefined);
  }
}

globalFunctions.addFactory(MaxFunction, {
  ...descriptorN,
  name: 'max',
  icon: 'txt:max',
});
