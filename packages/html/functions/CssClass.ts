import {BaseFunction, Functions, getInputsArray} from '@ticlo/core';
import {CssSheet, RuleHandle} from '../style/CssSheet.js';

const cssNameRegex = /^[a-zA-Z0-9_\-]+$/;

export class CssClassFunction extends BaseFunction {
  static #sheet: CssSheet = new CssSheet();
  #handles: RuleHandle;

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
    this.#handles?.remove();
    this.#handles = CssClassFunction.#sheet.addRuleGroup(
      this._data.getValue('name') as string,
      this._data.getValue('style') as Record<string, string | number>,
      additional
    );
    this._data.output(this.#handles.className);
  }
  cleanup(): void {
    if (this.#handles) {
      this.#handles.remove();
      this.#handles = undefined;
    }
  }
  destroy(): void {
    this.cleanup();
    super.destroy();
  }
}

Functions.add(
  CssClassFunction,
  {
    name: 'css-class',
    icon: 'fab:css3',
    priority: 1,
    properties: [
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
