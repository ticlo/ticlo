import {defaultConfigs, PropDesc} from '@ticlo/core';
import {Values} from './Values.ts';
import {PropMap} from './PropType.ts';

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
export const elementContentProperty: PropDesc = {
  name: 'content',
  type: 'any',
};

export const elementPropMap: PropMap = {
  style: {value: Values.any, type: 'object', create: 'html:create-style'},
  class: {value: Values.any, type: 'string'},
  content: {value: Values.any, type: 'any'},
};

export const elementProps: PropDesc[] = [elementClassProperty, elementStyleProperty, elementContentProperty];
