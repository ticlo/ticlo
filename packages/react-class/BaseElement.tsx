import {
  Block,
  StatefulFunction,
  BlockIO,
  DataMap,
  defaultConfigs,
  Functions,
  PropDesc,
  PropGroupDesc,
} from '@ticlo/core';
import React from 'react';
import {TicloComp} from './TicloComp.js';
import {htmlAttributes, htmlEventHandlers, optionalHtmlProperties} from '../react/attributes/HtmlAttributes.js';
import {BlockConfig} from '@ticlo/core/block/BlockProperty.js';
import {getInputsArray} from '@ticlo/core/block/FunctonData.js';

export class HtmlElementFunction extends StatefulFunction {
  // _comp never changes, this prevents re-render of any parent component, TicloComp should handle all the changes internally
  readonly _comp: React.ReactNode;

  readonly _eventHandlers = new Map<string, (e: any) => void>();

  constructor(block: Block) {
    super(block);
    this._comp = <TicloComp key={block._blockId} block={block} />;
  }

  inputChanged(input: BlockIO, val: any): boolean {
    return true;
  }
  configChanged(config: BlockConfig, val: any): boolean {
    return config._name === '+optional';
  }

  getComponent(): any {
    return 'div';
  }
  checkOptionalProp(field: string): any {
    return undefined;
  }
  getProps(): [DataMap, string[]] {
    let result: DataMap = {style: this._data.getValue('style'), className: this._data.getValue('class')};
    let optional = this._data.getOptionalProps();
    for (let field of optional) {
      if (Object.hasOwn(htmlAttributes, field)) {
        let value = this._data.getValue(field);
        if (value !== undefined) {
          result[field] = value;
        }
      } else if (Object.hasOwn(htmlEventHandlers, field)) {
        let handler = this._eventHandlers.get(field);
        // create the handler on demand
        if (!handler) {
          handler = (e: any) => {
            this._data.output(e, field);
          };
          this._eventHandlers.set(field, handler);
        }
        result[field] = handler;
      } else {
        let value = this.checkOptionalProp(field);
        if (value !== undefined) {
          result[field] = value;
        }
      }
    }
    return [result, optional];
  }
  getChildren(): any[] {
    let result = [];
    for (let val of getInputsArray(this._data, '', 0)) {
      result.push(val);
    }
    return result;
  }

  run(): any {
    let [props] = this.getProps();
    this._data.output(React.createElement(this.getComponent(), props, ...this.getChildren()), '#render');
    this._data.output(this._comp);
  }
  cleanup(): void {
    this._data.deleteValue('#output');
    this._data.deleteValue('#render');
  }
}

export const elementConfigs = defaultConfigs.concat('#render');

export const elementStyleProperty: PropDesc = {
  name: 'style',
  type: 'object',
  create: 'html:create-style',
};
export const elementClassProperty: PropDesc = {
  name: 'class',
  type: 'string',
};
export const elementChildrenProperty: PropGroupDesc = {
  name: '',
  type: 'group',
  defaultLen: 0,
  properties: [{name: '', type: 'any'}],
};
export const elementOutputProperty: PropDesc = {
  name: '#output',
  pinned: true,
  type: 'object',
  readonly: true,
};
