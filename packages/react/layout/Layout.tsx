import React from 'react';
import {Block, globalFunctions} from '@ticlo/core';
import {metaKey, renderChildren} from '../comp/Component.tsx';
import {elementAttributes, elementConfigs, elementProps} from '../comp/CommontProps.ts';
import {useTicloComp} from '../hooks/useTicloComp.ts';
import {optionalHtmlSuggestions} from '../elements/HtmlAttributes.ts';

function createLayout(name: string) {
  function Layout({block}: {block: Block}) {
    const {style, className, children, optionalHandlers} = useTicloComp(block);
    const layoutClass = `ticl-${name}`;
    return (
      <div style={style} className={className ? `${layoutClass} ${className}` : layoutClass} {...optionalHandlers}>
        {renderChildren(children)}
      </div>
    );
  }

  globalFunctions.addFactory(
    null,
    {
      name,
      icon: `14:-${name[0].toUpperCase()}-`,
      base: 'react:element',
      optionalSuggestions: optionalHtmlSuggestions,
      attributes: elementAttributes,
      tags: ['react-comp'],
      childrenTags: ['react-comp'],
      configs: elementConfigs,
      properties: elementProps,
      init: {style: {width: 200, height: 200}},
      category: 'react:elements',
    },
    'react',
    undefined,
    {meta: {[metaKey]: Layout}}
  );
  return Layout;
}

export const Horizontal = createLayout('horizontal');
export const Vertical = createLayout('vertical');
export const Absolute = createLayout('absolute');
