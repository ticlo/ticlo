import React from 'react';
import {Block, globalFunctions} from '@ticlo/core';
import {metaKey, renderChildren} from '../comp/Component.tsx';
import {elementConfigs, elementProps} from '../comp/CommontProps.ts';
import {useTicloComp} from '../hooks/useTicloComp.ts';

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
      base: 'react:element',
      tags: ['react-comp'],
      childrenTags: ['react-comp'],
      configs: elementConfigs,
      properties: elementProps,
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
