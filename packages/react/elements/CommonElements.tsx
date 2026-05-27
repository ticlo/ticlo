import React from 'react';
import {FunctionDesc, PropDesc, PropGroupDesc} from '@ticlo/core/block/Descriptor.js';
import {elementConfigs, elementProps} from '../comp/CommontProps.js';
import {Block, globalFunctions} from '@ticlo/core';
import {useTicloComp} from '../hooks/useTicloComp.js';
import {metaKey, renderChildren} from '../comp/Component.js';

const sharedElementDesc: FunctionDesc = {
  name: '',
  base: 'react:element',
  configs: elementConfigs,
  properties: elementProps,
  category: 'react:elements',
};

function DivElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block);
  return (
    <div style={style} className={className} {...optionalHandlers}>
      {renderChildren(children)}
    </div>
  );
}
globalFunctions.addFactory(null, {...sharedElementDesc, name: 'div'}, 'react', undefined, {
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
globalFunctions.addFactory(null, {...sharedElementDesc, name: 'span'}, 'react', undefined, {
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
globalFunctions.addFactory(null, {...sharedElementDesc, name: 'p'}, 'react', undefined, {
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
globalFunctions.addFactory(null, {...sharedElementDesc, name: 'pre'}, 'react', undefined, {
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
globalFunctions.addFactory(null, {...sharedElementDesc, name: 'button'}, 'react', undefined, {
  meta: {[metaKey]: ButtonElement},
});
