import {BaseFunction} from '../../../block/BlockFunction';
import {Functions} from '../../../block/Functions';
import {FunctionDesc} from '../../../block/Descriptor';

const descriptor: FunctionDesc = {
  name: '',
  icon: '',
  recipient: '0',
  category: 'string',
  properties: [
    {name: '0', type: 'string', visible: 'high'},
    {name: '1', type: 'string', visible: 'high'},
    {name: 'output', type: 'toggle', readonly: true}
  ]
};

export class StartWithFunction extends BaseFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
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
  icon: 'txt:a~'
});

export class EndWithFunction extends BaseFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    if (Array.isArray(v0)) {
      if (v0.length) {
        this._data.output(Object.is(v0[v0.length - 1], v1));
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
  icon: 'txt:~a'
});

export class ContainFunction extends BaseFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');

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
  icon: 'txt:.a.'
});
