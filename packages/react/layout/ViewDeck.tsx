import React from 'react';
import {Block, globalFunctions} from '@ticlo/core';
import {metaKey, renderChildren} from '../comp/Component.tsx';
import {elementAttributes, elementConfigs, elementProps} from '../comp/CommontProps.ts';
import {revealChildMetaKey, selectedIndexProperty, toSelectedIndex} from '../comp/Selection.ts';
import {optionalHtmlSuggestions} from '../elements/HtmlAttributes.ts';
import {useBlockValue} from '../hooks/useBlockValue.ts';
import {getChildren, useTicloComp} from '../hooks/useTicloComp.ts';

export function ViewDeck({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block);
  const selectedIndex = toSelectedIndex(useBlockValue(block, 'selectedIndex'), 0);
  const child = children[selectedIndex];
  return (
    <div style={style} className={className ? `ticl-view-deck ${className}` : 'ticl-view-deck'} {...optionalHandlers}>
      {renderChildren(child === undefined ? [] : [child])}
    </div>
  );
}

globalFunctions.addFactory(
  null,
  {
    name: 'view-deck',
    icon: 'txt:-D-',
    base: 'react:element',
    optionalSuggestions: optionalHtmlSuggestions,
    attributes: elementAttributes,
    tags: ['react-comp'],
    childrenTags: ['react-comp'],
    configs: elementConfigs,
    properties: [...elementProps, {...selectedIndexProperty, default: 0}],
    init: {style: {width: 200, height: 200}},
    category: 'react:elements',
  },
  'react',
  undefined,
  {
    meta: {
      [metaKey]: ViewDeck,
      [revealChildMetaKey](block: Block, child: Block) {
        const index = getChildren(block, block.getValue('#order'), block.getValue('content')).indexOf(child);
        if (index >= 0) block.updateValue('selectedIndex', index);
      },
    },
  }
);
