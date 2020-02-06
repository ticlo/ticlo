import {Block, BlockFunction, BlockIO, DataMap, Functions, PropDesc, PropGroupDesc} from '../core';
import React from 'react';
import {TicloComp} from './TicloComp';
import {htmlAttributes, htmlEventHandlers, optionalHtmlProperties} from './HtmlAttributes';
import {BlockConfig} from '../../src/core/block/BlockProperty';

export class HtmlElementFunction extends BlockFunction {
  // _comp never changes, this prevent re-render of any parent component, TicloComp should handle all the changes internally
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
    return config._name === '#optional';
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
      if (htmlAttributes.hasOwnProperty(field)) {
        let value = this._data.getValue(field);
        if (value !== undefined) {
          result[field] = value;
        }
      } else if (htmlEventHandlers.hasOwnProperty(field)) {
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
    let len = this._data.getLength('', 0);
    for (let i = 0; i < len; ++i) {
      result.push(this._data.getValue(`${i}`));
    }
    return result;
  }

  run(): any {
    let [props] = this.getProps();
    this._data.output(React.createElement(this.getComponent(), props, ...this.getChildren()), '#render');
    this._data.output(this._comp);
  }
}

export const elementConfigs = ['#call', '#mode', '#priority', '#sync', '#render'];

export const elementStyleProperty: PropDesc = {
  name: 'style',
  type: 'object',
  visible: 'low',
  create: 'html:create-style'
};
export const elementClassProperty: PropDesc = {
  name: 'class',
  type: 'string'
};
export const elementChildrenProperty: PropGroupDesc = {
  name: '',
  type: 'group',
  defaultLen: 0,
  properties: [{name: '', type: 'any'}]
};
export const elementOutputProperty: PropDesc = {
  name: '#output',
  type: 'object',
  readonly: true
};
