import React from 'react';
import {FunctionDesc, PropDesc, PropGroupDesc} from '@ticlo/core/block/Descriptor.js';
import {elementConfigs, elementProps} from '../comp/CommontProps.js';
import {Block} from '@ticlo/core';
import {useTicloComp} from '../hooks/useTicloComp.js';
import {registerComponent, renderChildren} from '../comp/Component.js';

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
registerComponent(DivElement, 'div', null, {...sharedElementDesc, name: 'div'}, 'react');

function SpanElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block);
  return (
    <span style={style} className={className} {...optionalHandlers}>
      {renderChildren(children)}
    </span>
  );
}
registerComponent(SpanElement, 'span', null, {...sharedElementDesc, name: 'span'}, 'react');

function PElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block);
  return (
    <p style={style} className={className} {...optionalHandlers}>
      {renderChildren(children)}
    </p>
  );
}
registerComponent(PElement, 'p', null, {...sharedElementDesc, name: 'p'}, 'react');

function PreElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block);
  return (
    <pre style={style} className={className} {...optionalHandlers}>
      {renderChildren(children)}
    </pre>
  );
}
registerComponent(PreElement, 'pre', null, {...sharedElementDesc, name: 'pre'}, 'react');

function ButtonElement({block}: {block: Block}) {
  const {style, className, children, optionalHandlers} = useTicloComp(block);
  return (
    <button style={style} className={className} {...optionalHandlers}>
      {renderChildren(children)}
    </button>
  );
}
registerComponent(ButtonElement, 'button', null, {...sharedElementDesc, name: 'button'}, 'react');
