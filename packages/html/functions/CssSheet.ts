import {BaseFunction, Functions, getInputsArray} from '@ticlo/core';
import {CssSheet, DisabledCssSheet, RuleHandle} from '../style/CssSheet.js';

const cssNameRegex = /^[a-zA-Z0-9_\-]+$/;

const disabledSheet = new DisabledCssSheet();

export class CssSheetFunction extends BaseFunction {
  private _sheet: CssSheet;

  run() {
    this.cleanup();
    if (!this._data.getValue('enabled')) {
      this._data.output(disabledSheet, '#output');
      return;
    }
    let prefix = this._data.getValue('prefix') as string;
    if (typeof prefix !== 'string' || !cssNameRegex.test(prefix)) {
      prefix = undefined;
    }
    this._sheet = new CssSheet(prefix);
    this._data.output(this._sheet, '#output');
  }
  cleanup(): void {
    if (this._sheet) {
      this._sheet.destroy();
      this._sheet = undefined;
    }
  }
  destroy(): void {
    this.cleanup();
    super.destroy();
  }
}

Functions.add(
  CssSheetFunction,
  {
    name: 'css-sheet',
    icon: 'fab:css3',
    priority: 1,
    properties: [
      {name: 'prefix', type: 'string'},
      {name: 'enabled', type: 'toggle', init: true, pinned: true},
      {name: '#output', type: 'object', readonly: true, pinned: true},
    ],
    tags: ['css-sheet'],
  },
  'html'
);
