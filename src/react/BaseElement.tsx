import {Block, BlockFunction, BlockIO, DataMap, Functions} from '../core';
import React from 'react';
import {TicloComp} from './TicloComp';
import {htmlAttributes, htmlEventHandlers, optionalHtmlProperties} from './HtmlAttributes';

export class HtmlElementFunction extends BlockFunction {
  // _comp never changes, this prevent re-render of any parent component, TicloComp should handle all the changes internally
  readonly _comp: React.ReactNode;

  readonly _eventHandlers = new Map<string, (e: any) => void>();

  constructor(block: Block) {
    super(block);
    this._comp = <TicloComp key={block._blockId} block={block} />;
  }

  inputChanged(input: BlockIO, val: any): boolean {
    return optionalHtmlProperties.hasOwnProperty(input._name);
  }
  getComponent(): any {
    return 'div';
  }
  getProps(): DataMap {
    let result: DataMap = {};
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
      }
    }
    return result;
  }
  getChildren(): any[] {
    let result = [];
    let len = this._data.getLength();
    for (let i = 0; i < len; ++i) {
      result.push(this._data.getValue(`${i}`));
    }
    return result;
  }

  run(): any {
    this._data.output(React.createElement(this.getComponent(), this.getProps(), ...this.getChildren()), '#render');
    this._data.output(this._comp);
  }
}
