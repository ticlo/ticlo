import React from 'react';
import {FunctionDesc} from '@ticlo/core/block/Descriptor.ts';
import {elementAttributes, elementConfigs, elementProps} from '../comp/CommontProps.ts';
import {Block, globalFunctions} from '@ticlo/core';
import {useTicloComp} from '../hooks/useTicloComp.ts';
import {metaKey, renderChildren} from '../comp/Component.tsx';
import {optionalHtmlSuggestions} from './HtmlAttributes.ts';

function createElementDesc(name: string, icon: string): FunctionDesc {
  return {
    name,
    icon,
    base: 'react:element',
    optionalSuggestions: optionalHtmlSuggestions,
    attributes: elementAttributes,
    tags: ['react-comp'],
    childrenTags: ['react-comp'],
    configs: elementConfigs,
    properties: elementProps,
    init: {content: name},
    category: 'react:elements',
  };
}

function DivElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block);
  return (
    <div style={style} className={className} {...optionalHandlers}>
      {renderChildren(children)}
    </div>
  );
}
globalFunctions.addFactory(null, createElementDesc('div', 'txt:div'), 'react', undefined, {
  meta: {[metaKey]: DivElement},
});

function SpanElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block);
  return (
    <span style={style} className={className} {...optionalHandlers}>
      {renderChildren(children)}
    </span>
  );
}
globalFunctions.addFactory(null, createElementDesc('span', 'txt:spn'), 'react', undefined, {
  meta: {[metaKey]: SpanElement},
});

function PElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block);
  return (
    <p style={style} className={className} {...optionalHandlers}>
      {renderChildren(children)}
    </p>
  );
}
globalFunctions.addFactory(null, createElementDesc('p', 'txt:p'), 'react', undefined, {
  meta: {[metaKey]: PElement},
});

function PreElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block);
  return (
    <pre style={style} className={className} {...optionalHandlers}>
      {renderChildren(children)}
    </pre>
  );
}
globalFunctions.addFactory(null, createElementDesc('pre', 'txt:pre'), 'react', undefined, {
  meta: {[metaKey]: PreElement},
});

function ButtonElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block);
  return (
    <button style={style} className={className} {...optionalHandlers}>
      {renderChildren(children)}
    </button>
  );
}
globalFunctions.addFactory(null, createElementDesc('button', 'txt:btn'), 'react', undefined, {
  meta: {[metaKey]: ButtonElement},
});
