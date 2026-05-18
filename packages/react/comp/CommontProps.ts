import {defaultConfigs, PropDesc} from '@ticlo/core';
import {Values} from './Values.js';
import {PropMap} from './PropType.js';

export const elementConfigs = defaultConfigs.concat('#order');

export const elementStyleProperty: PropDesc = {
  name: 'style',
  type: 'object',
  create: 'html:create-style',
};
export const elementClassProperty: PropDesc = {
  name: 'class',
  type: 'string',
};

export const elementPropMap: PropMap = {
  style: {value: Values.any, type: 'object', create: 'html:create-style'},
  class: {value: Values.any, type: 'string'},
};

export const elementProps: PropDesc[] = [elementClassProperty, elementStyleProperty];
