import {DataMap, FunctionDesc, Functions, PropDesc} from '@ticlo/core';
import {
  elementClassProperty,
  elementConfigs,
  elementOutputProperty,
  elementStyleProperty,
  HtmlElementFunction,
} from '../BaseElement.js';
import {ChangeEvent} from 'react';

const optional: {[key: string]: PropDesc} = {
  accept: {name: 'accept', type: 'string'},
  alt: {name: 'alt', type: 'string'},
  autoComplete: {name: 'autoComplete', type: 'string'},
  autoFocus: {name: 'autoFocus', type: 'toggle'},
  capture: {name: 'capture', type: 'any', types: ['toggle', 'string']}, // https://www.w3.org/TR/html-media-capture/#the-capture-attribute
  checked: {name: 'checked', type: 'toggle'},
  crossOrigin: {name: 'crossOrigin', type: 'string'},
  disabled: {name: 'disabled', type: 'toggle'},
  form: {name: 'form', type: 'string'},
  formAction: {name: 'formAction', type: 'string'},
  formEncType: {name: 'formEncType', type: 'string'},
  formMethod: {name: 'formMethod', type: 'string'},
  formNoValidate: {name: 'formNoValidate', type: 'toggle'},
  formTarget: {name: 'formTarget', type: 'string'},
  height: {name: 'height', type: 'any', types: ['number', 'string']},
  list: {name: 'list', type: 'string'},
  max: {name: 'max', type: 'any', types: ['number', 'string']},
  maxLength: {name: 'maxLength', type: 'number'},
  min: {name: 'min', type: 'any', types: ['number', 'string']},
  minLength: {name: 'minLength', type: 'number'},
  multiple: {name: 'multiple', type: 'toggle'},
  name: {name: 'name', type: 'string'},
  pattern: {name: 'pattern', type: 'string'},
  placeholder: {name: 'placeholder', type: 'string'},
  readOnly: {name: 'readOnly', type: 'toggle'},
  required: {name: 'required', type: 'toggle'},
  size: {name: 'size', type: 'number'},
  src: {name: 'src', type: 'string'},
  step: {name: 'step', type: 'any', types: ['number', 'string']},
  type: {name: 'type', type: 'string'},
  width: {name: 'width', type: 'any', types: ['number', 'string']},
};

const inputElementDesc: FunctionDesc = {
  name: 'input',
  base: 'react:element',
  configs: elementConfigs,
  properties: [
    {
      name: 'value',
      type: 'any',
      types: ['string', 'number'],
    },
    elementClassProperty,
    elementStyleProperty,
    elementOutputProperty,
  ],
  optional,
  category: 'react:elements',
};

class InputElementFunction extends HtmlElementFunction {
  trackChange = (e: ChangeEvent<HTMLInputElement>) => {
    this._data.output(e.target.value, 'value');
  };
  getComponent(): any {
    return 'input';
  }
  checkOptionalProp(field: string): any {
    if (Object.hasOwn(optional, field)) {
      return this._data.getValue(field);
    }
    return undefined;
  }
  getProps(): [DataMap, string[]] {
    const [result, optional] = super.getProps();
    const valueProp = this._data.getProperty('value');
    if (!valueProp || valueProp.isCleared()) {
      if (!optional.includes('onChange')) {
        result.onChange = this.trackChange;
      }
    } else {
      result.value = valueProp._value;
    }

    return [result, optional];
  }
  getChildren(): any[] {
    return [];
  }
}

Functions.add(InputElementFunction, inputElementDesc, 'react');
