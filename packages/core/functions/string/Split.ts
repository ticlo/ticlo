import {globalFunctions} from '../../block/FunctionLib.ts';
import {PureFunction} from '../../block/BlockFunction.ts';
import {ErrorEvent} from '../../block/Event.ts';

export class SplitFunction extends PureFunction {
  // REFACTOR(design.md): MUST read event inputs for this delivery; MUST retain prior values only as declared state.
  run(): any {
    const input = this._data.getValue('input');
    if (typeof input === 'string') {
      let separator: string | RegExp = this._data.getValue('separator') as string;
      if (typeof separator !== 'string') {
        separator = ',';
      } else if (this._data.getValue('regExp')) {
        try {
          separator = new RegExp(separator, 'g');
        } catch (e) {
          this._data.output(undefined);
          return new ErrorEvent('invalidRegexp');
        }
      }

      this._data.output(input.split(separator));
    } else {
      this._data.output(undefined);
    }
  }
}

globalFunctions.addFactory(SplitFunction, {
  name: 'split',
  icon: '15^:s,p',
  properties: [
    {name: 'input', pinned: true, type: 'string'},
    {name: 'separator', type: 'string', placeholder: ','},
    {name: 'regExp', type: 'toggle'},
    {name: '#output', pinned: true, type: 'array', readonly: true},
  ],
  recipient: '0',
  category: 'string',
});
