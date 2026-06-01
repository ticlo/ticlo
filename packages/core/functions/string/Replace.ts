import {PureFunction} from '../../block/BlockFunction.js';
import {ErrorEvent} from '../../block/Event.js';
import {globalFunctions} from '../../block/FunctionLib.js';

const descriptor = {
  recipient: '0',
  category: 'string',
};

export class ReplaceFunction extends PureFunction {
  run(): any {
    const input = this._data.getValue('input');
    const search = this._data.getValue('search');
    const replacement = this._data.getValue('replacement');
    if (typeof input === 'string' && typeof search === 'string' && typeof replacement === 'string') {
      this._data.output(input.replaceAll(search, replacement));
    } else {
      this._data.output(undefined);
    }
  }
}

globalFunctions.addFactory(ReplaceFunction, {
  ...descriptor,
  name: 'replace',
  icon: 'txt:re',
  properties: [
    {name: 'input', pinned: true, type: 'string'},
    {name: 'search', pinned: true, type: 'string'},
    {name: 'replacement', pinned: true, type: 'string'},
    {name: '#output', pinned: true, type: 'string', readonly: true},
  ],
});

export class ReplaceRegexFunction extends PureFunction {
  run(): any {
    const input = this._data.getValue('input');
    const pattern = this._data.getValue('pattern');
    const replacement = this._data.getValue('replacement');
    if (typeof input === 'string' && typeof pattern === 'string' && typeof replacement === 'string') {
      let flags = this._data.getValue('flags') as string;
      if (typeof flags !== 'string') {
        flags = 'g';
      }
      try {
        this._data.output(input.replace(new RegExp(pattern, flags), replacement));
      } catch (e) {
        this._data.output(undefined);
        return new ErrorEvent('invalidRegexp');
      }
    } else {
      this._data.output(undefined);
    }
  }
}

globalFunctions.addFactory(ReplaceRegexFunction, {
  ...descriptor,
  name: 'replace-regex',
  icon: 'txt:r*',
  properties: [
    {name: 'input', pinned: true, type: 'string'},
    {name: 'pattern', pinned: true, type: 'string'},
    {name: 'replacement', pinned: true, type: 'string'},
    {name: 'flags', type: 'string', default: 'g'},
    {name: '#output', pinned: true, type: 'string', readonly: true},
  ],
});
