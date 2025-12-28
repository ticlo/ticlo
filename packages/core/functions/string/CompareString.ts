import {PureFunction} from '../../block/BlockFunction.js';
import {Functions} from '../../block/Functions.js';
import {FunctionDesc} from '../../block/Descriptor.js';

const descriptor: FunctionDesc = {
  name: '',
  icon: '',
  recipient: '0',
  category: 'string',
  properties: [
    {name: 'input', type: 'string', pinned: true},
    {name: 'search', type: 'string', pinned: true},
    {name: '#output', pinned: true, type: 'toggle', readonly: true},
  ],
};

export class StartWithFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('input');
    const v1 = this._data.getValue('search');
    if (Array.isArray(v0)) {
      if (v0.length) {
        this._data.output(Object.is(v0[0], v1));
      } else {
        this._data.output(false);
      }
    } else if (typeof v0 === 'string' && typeof v1 === 'string') {
      this._data.output(v0.startsWith(v1));
    } else {
      this._data.output(undefined);
    }
  }
}

Functions.add(StartWithFunction, {
  ...descriptor,
  name: 'start-with',
  icon: 'txt:a~',
});

export class EndWithFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('input');
    const v1 = this._data.getValue('search');
    if (Array.isArray(v0)) {
      if (v0.length) {
        this._data.output(Object.is(v0.at(-1), v1));
      } else {
        this._data.output(false);
      }
    } else if (typeof v0 === 'string' && typeof v1 === 'string') {
      this._data.output(v0.endsWith(v1));
    } else {
      this._data.output(undefined);
    }
  }
}

Functions.add(EndWithFunction, {
  ...descriptor,
  name: 'end-with',
  icon: 'txt:~a',
});

export class ContainFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('input');
    const v1 = this._data.getValue('search');

    if (Array.isArray(v0)) {
      this._data.output(v0.includes(v1));
    } else if (typeof v0 === 'string' && typeof v1 === 'string') {
      this._data.output(v0.includes(v1));
    } else {
      this._data.output(undefined);
    }
  }
}

Functions.add(ContainFunction, {
  ...descriptor,
  name: 'contain',
  icon: 'txt:.a.',
});
