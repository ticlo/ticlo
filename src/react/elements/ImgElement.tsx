import {DataMap, FunctionDesc, Functions, PropDesc} from '../../core';
import {
  elementClassProperty,
  elementConfigs,
  elementOutputProperty,
  elementStyleProperty,
  HtmlElementFunction,
} from '../BaseElement';

const optional: {[key: string]: PropDesc} = {
  crossOrigin: {name: 'crossOrigin', type: 'select', options: ['anonymous', 'use-credentials']},
  decoding: {name: 'decoding', type: 'select', options: ['async', 'auto', 'sync']},
  width: {name: 'width', type: 'any', types: ['number', 'string']},
  height: {name: 'height', type: 'any', types: ['number', 'string']},
  alt: {name: 'alt', type: 'string'},
  size: {name: 'size', type: 'string'},
  srcSet: {name: 'srcSet', type: 'string'},
  useMap: {name: 'useMap', type: 'string'},
};

const imgElementDesc: FunctionDesc = {
  name: 'img',
  base: 'react:element',
  configs: elementConfigs,
  properties: [
    {
      name: 'src',
      type: 'string',
    },
    elementClassProperty,
    elementStyleProperty,
    elementOutputProperty,
  ],
  optional,
  category: 'react:elements',
};

class ImgElementFunction extends HtmlElementFunction {
  getComponent(): any {
    return 'img';
  }
  checkOptionalProp(field: string): any {
    if (optional.hasOwnProperty(field)) {
      return this._data.getValue(field);
    }
    return undefined;
  }
  getProps(): [DataMap, string[]] {
    let [result, optional] = super.getProps();
    result.src = this._data.getValue('src');
    return [result, optional];
  }
  getChildren(): any[] {
    return [];
  }
}

Functions.add(ImgElementFunction, imgElementDesc, 'react');
