import React from 'react';
import {JsFunction, SCRIPT_ERROR} from '@ticlo/core/functions/script/Js.js';
import {Functions} from '@ticlo/core/block/Functions.js';
import {Block} from '@ticlo/core/block/Block.js';
import {TicloComp} from './TicloComp.js';
import {validateReactComponent} from './validateReactComponent.js';
import {elementConfigs} from './BaseElement.js';
import {BlockIO, ErrorEvent} from '@ticlo/core';

const HOOKS = `const {
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef
} = React;`;

export class JsxFunction extends JsFunction {
  readonly _comp: React.ReactNode;
  _functionalComponent: Function;

  constructor(block: Block) {
    super(block);
    this._comp = <TicloComp key={block._blockId} block={block} />;
    this._data.output(this._comp);
  }
  inputChanged(input: BlockIO, val: any): boolean {
    // ignore parent implementation of inputChanged
    if (input._name === 'script') {
      this._compiledFunction = null;
      this._runFunction = null;
      this._functionalComponent = null;
      this._preProcessed = false;
      return val !== undefined;
    }
    return Boolean(this._runFunction || this._functionalComponent);
  }

  parseFunction(script: string): Function {
    const Babel = (window as any).Babel;

    if (Babel) {
      const toTransform = `"use strict";const React={};${HOOKS}function _F_(){${script}}`;
      const code = Babel.transform(toTransform, {presets: ['es2017', 'react']}).code;
      script = code.substring(33).replace('function _F_() ', '');
    }
    return new Function('React', script);
  }

  outputResult(result: unknown) {
    if (validateReactComponent(result)) {
      this._data.output(result, '#render');
      return this._comp;
    } else {
      this._data.output(undefined, '#render');
    }
    return result;
  }

  applyFunction(): any {
    let result: unknown;
    if (this._runFunction) {
      result = super.applyFunction();
    } else if (this._functionalComponent) {
      const Comp = this._functionalComponent;

      // @ts-ignore
      result = <Comp data={this.getDataProxy()} />;
    }
    return this.outputResult(result);
  }

  preProcessCompileResult() {
    let result: unknown;
    try {
      result = this._compiledFunction.call(this.getDataProxy(), React);
    } catch (err) {
      this._compiledFunction = null;
      return new ErrorEvent(SCRIPT_ERROR, err);
    }
    if (typeof result === 'function') {
      // let the function run again
      this._functionalComponent = result;
    } else {
      this._runFunction = this._compiledFunction;
      return this.outputResult(result);
    }
    return undefined;
  }
  cleanup() {
    this._data.output(undefined, '#render');
    super.cleanup();
  }
}

Functions.add(
  JsxFunction,
  {
    name: 'jsx',
    configs: elementConfigs,
    properties: [
      {
        name: 'script',
        type: 'string',
        mime: 'text/jsx',
        pinned: true,
      },
      {
        name: '#output',
        pinned: true,
        type: 'object',
        readonly: true,
      },
    ],
  },
  'react'
);
