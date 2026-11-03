import React from 'react';
import {Block, globalFunctions, type FunctionDesc} from '@ticlo/core';
import {
  elementAttributes,
  elementClassProperty,
  elementConfigs,
  elementContentProperty,
  elementStyleProperty,
} from '../comp/CommontProps.ts';
import {metaKey, renderChildren} from '../comp/Component.tsx';
import {useTicloComp} from '../hooks/useTicloComp.ts';

interface SvgElementDefinition {
  name: string;
  icon: string;
  init?: FunctionDesc['init'];
  suggestions?: string[];
  childrenTags?: string[];
  content?: boolean;
}

function registerSvgElement({name, icon, init, suggestions, childrenTags, content}: SvgElementDefinition) {
  const hasChildren = childrenTags !== undefined || content;
  function SvgElement({block}: {block: Block}) {
    const {style, className, children, optionalHandlers} = useTicloComp(block, {noChildren: !hasChildren});
    return React.createElement(
      name,
      {style, className, ...optionalHandlers},
      ...(hasChildren ? renderChildren(children) : [])
    );
  }
  globalFunctions.addFactory(
    null,
    {
      name,
      icon,
      base: 'react:svg-element',
      attributes: elementAttributes,
      tags: name === 'svg' ? ['react-comp', 'react-svg'] : ['react-svg'],
      childrenTags,
      configs: hasChildren ? elementConfigs : undefined,
      properties: [elementClassProperty, elementStyleProperty, ...(content ? [elementContentProperty] : [])],
      optionalSuggestions: suggestions,
      init,
      category: name === 'svg' ? undefined : 'react:svg',
    },
    'react',
    undefined,
    {meta: {[metaKey]: SvgElement}}
  );
}

registerSvgElement({
  name: 'svg',
  icon: '20:⬠',
  childrenTags: ['react-svg'],
  suggestions: ['viewBox', 'width', 'height', 'preserveAspectRatio', 'fill', 'stroke'],
  init: {'style': {width: 200, height: 200}, '#optional': ['viewBox'], 'viewBox': '0 0 100 100'},
});
registerSvgElement({
  name: 'g',
  icon: '20:◇',
  childrenTags: ['react-svg'],
  suggestions: ['transform', 'fill', 'stroke'],
});
registerSvgElement({
  name: 'rect',
  icon: '20:▭',
  suggestions: ['x', 'y', 'width', 'height', 'rx', 'fill', 'stroke'],
  init: {'#optional': ['x', 'y', 'width', 'height'], 'x': 10, 'y': 10, 'width': 80, 'height': 80},
});
registerSvgElement({
  name: 'circle',
  icon: '20:◯',
  suggestions: ['cx', 'cy', 'r', 'fill', 'stroke'],
  init: {'#optional': ['cx', 'cy', 'r'], 'cx': 50, 'cy': 50, 'r': 40},
});
registerSvgElement({
  name: 'ellipse',
  icon: '20:⬭',
  suggestions: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke'],
  init: {'#optional': ['cx', 'cy', 'rx', 'ry'], 'cx': 50, 'cy': 50, 'rx': 40, 'ry': 30},
});
registerSvgElement({
  name: 'line',
  icon: '20:╱',
  suggestions: ['x1', 'y1', 'x2', 'y2', 'stroke', 'strokeWidth'],
  init: {
    '#optional': ['x1', 'y1', 'x2', 'y2', 'stroke'],
    'x1': 10,
    'y1': 10,
    'x2': 90,
    'y2': 90,
    'stroke': 'currentColor',
  },
});
registerSvgElement({
  name: 'polyline',
  icon: '20:⌁',
  suggestions: ['points', 'fill', 'stroke', 'strokeWidth'],
  init: {
    '#optional': ['points', 'fill', 'stroke'],
    'points': '10,90 50,10 90,90',
    'fill': 'none',
    'stroke': 'currentColor',
  },
});
registerSvgElement({
  name: 'polygon',
  icon: '20:△',
  suggestions: ['points', 'fill', 'stroke'],
  init: {'#optional': ['points'], 'points': '50,10 90,90 10,90'},
});
registerSvgElement({
  name: 'path',
  icon: '20:⌁',
  suggestions: ['d', 'fill', 'stroke', 'strokeWidth'],
  init: {'#optional': ['d'], 'd': 'M 10 90 L 50 10 L 90 90 Z'},
});
registerSvgElement({
  name: 'text',
  icon: '20:T',
  content: true,
  suggestions: ['x', 'y', 'fontSize', 'fill', 'textAnchor'],
  init: {'content': 'Text', '#optional': ['x', 'y'], 'x': 10, 'y': 50},
});
registerSvgElement({
  name: 'foreignObject',
  icon: '20:▣',
  childrenTags: ['react-comp'],
  suggestions: ['x', 'y', 'width', 'height'],
  init: {'#optional': ['x', 'y', 'width', 'height'], 'x': 0, 'y': 0, 'width': 100, 'height': 100},
});
