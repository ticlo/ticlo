import {Block, DataMap, FunctionDesc, globalFunctions, PropDesc} from '@ticlo/core';

import {useTicloComp} from '../hooks/useTicloComp.ts';
import {metaKey} from '../comp/Component.tsx';
import React from 'react';
import {elementClassProperty, elementConfigs, elementStyleProperty} from '../comp/CommontProps.ts';
import {useBlockConfigs} from '../hooks/useBlockConfigs.ts';
import {Values} from '../comp/Values.ts';

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
  const {style, className, optionalHandlers} = useTicloComp(block, imageOptions);
  const {src} = useBlockConfigs(block, imagePropMap);
  return <img src={src} style={style} className={className} {...optionalHandlers} />;
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
globalFunctions.addFactory(null, imgElementDesc, 'react', undefined, {
  meta: {[metaKey]: ImageElement},
});
