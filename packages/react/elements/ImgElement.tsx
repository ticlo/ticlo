import {Block, DataMap, FunctionDesc, Functions, PropDesc} from '@ticlo/core';

import {useTicloComp} from '../hooks/useTicloComp.js';
import {registerComponent, renderChildren} from '../comp/Component.js';
import React from 'react';
import {elementClassProperty, elementConfigs, elementStyleProperty} from '../comp/CommontProps.js';
import {useBlockConfigs} from '../hooks/useBlockConfigs.js';
import {Values} from '../comp/Values.js';

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

const imageOptions = {
  noChildren: true,
};

const imagePropMap = {
  src: {value: Values.string},
};

function ImageElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block, imageOptions);
  const {src} = useBlockConfigs(block, imagePropMap);
  return (
    <img src={src} style={style} className={className} {...optionalHandlers}>
      {renderChildren(children)}
    </img>
  );
}
const imgElementDesc: FunctionDesc = {
  name: 'img',
  base: 'react:element',
  properties: [
    {
      name: 'src',
      type: 'string',
    },
    elementStyleProperty,
    elementClassProperty,
  ],
  optional,
  category: 'react:elements',
};
registerComponent(ImageElement, 'img', null, imgElementDesc, 'react');
