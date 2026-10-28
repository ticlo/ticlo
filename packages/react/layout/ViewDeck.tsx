import React, {useContext, useRef} from 'react';
import {Block, globalFunctions} from '@ticlo/core';
import {metaKey} from '../comp/Component.tsx';
import {elementAttributes, elementConfigs, elementProps} from '../comp/CommontProps.ts';
import {revealChildMetaKey, selectedIndexProperty, toSelectedIndex} from '../comp/Selection.ts';
import {optionalHtmlSuggestions} from '../elements/HtmlAttributes.ts';
import {useBlockValue} from '../hooks/useBlockValue.ts';
import {getChildren, useTicloComp} from '../hooks/useTicloComp.ts';
import {ComponentContext} from '../ComponentContext.ts';
import {ViewDeckContent} from './ViewDeckContent.tsx';
import {deckAnimations} from './ViewDeckAnimation.ts';

export function ViewDeck({block}: {block: Block}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const {style, className, children, optionalHandlers} = useTicloComp(block, {ref: elementRef});
  const selectedIndex = toSelectedIndex(useBlockValue(block, 'selectedIndex'), 0);
  const {designMode} = useContext(ComponentContext);
  return (
    <ViewDeckContent
      index={selectedIndex}
      designMode={designMode}
      animation={useBlockValue(block, 'animation')}
      showEffect={useBlockValue(block, 'showEffect')}
      hideEffect={useBlockValue(block, 'hideEffect')}
      style={style}
      className={className}
      handlers={optionalHandlers}
      elementRef={elementRef}
    >
      {children}
    </ViewDeckContent>
  );
}

globalFunctions.addFactory(
  null,
  {
    name: 'view-deck',
    icon: '14^:-D-',
    base: 'react:element',
    optionalSuggestions: optionalHtmlSuggestions,
    attributes: elementAttributes,
    tags: ['react-comp'],
    childrenTags: ['react-comp'],
    configs: elementConfigs,
    properties: [
      ...elementProps,
      {...selectedIndexProperty, default: 0},
      {name: 'animation', type: 'select', options: deckAnimations, default: 'none'},
      {name: 'showEffect', type: 'string'},
      {name: 'hideEffect', type: 'string'},
    ],
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
