import {BaseFunction, globalFunctions, getInputsArray} from '@ticlo/core';
import {CssSheet, RuleHandle} from '../style/CssSheet.js';

const cssNameRegex = /^[a-zA-Z0-9_\-]+$/;

export class CssClassFunction extends BaseFunction {
  private static _sheet: CssSheet = new CssSheet();
  private _handles: RuleHandle;

  run() {
    const additional: {selector: string; style: Record<string, string | number>}[] = [];
    for (const {selector, style} of getInputsArray(this._data, '', 0, ['selector', 'style'])) {
      if (typeof selector !== 'string') {
        continue;
      }
      if (typeof style !== 'object') {
        continue;
      }
      let finalSelector = selector;
      if (!selector.includes('&') && cssNameRegex.test(selector)) {
        // automatically convert class name to css selector
        finalSelector = '& .' + finalSelector;
      }

      additional.push({selector: finalSelector, style: style as Record<string, string | number>});
    }
    this._handles?.remove();
    let cssSheet = this._data.getValue('cssSheet') as CssSheet;
    if (typeof cssSheet?.addRuleGroup !== 'function') {
      cssSheet = CssClassFunction._sheet;
    }
    this._handles = cssSheet.addRuleGroup(
      this._data.getValue('name') as string,
      this._data.getValue('style') as Record<string, string | number>,
      additional
    );
    this._data.output(this._handles.className);
  }
  cleanup(): void {
    if (this._handles) {
      this._handles.remove();
      this._handles = undefined;
    }
  }
  destroy(): void {
    this.cleanup();
    super.destroy();
  }
}

globalFunctions.add(
  CssClassFunction,
  {
    name: 'css-class',
    icon: 'fab:css3',
    priority: 1,
    properties: [
      {name: 'cssSheet', type: 'service', options: ['css-sheet']},
      {name: 'name', type: 'string', pinned: true},
      {name: 'style', type: 'object', create: 'html:create-style'},
      {
        name: '',
        type: 'group',
        defaultLen: 0,
        properties: [
          {name: 'selector', type: 'string', pinned: true},
          {name: 'style', type: 'object', create: 'html:create-style'},
        ],
      },
      {name: '#output', type: 'string', pinned: true, readonly: true},
    ],
  },
  'html'
);
