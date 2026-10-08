import React, {useMemo} from 'react';
import {Block, globalFunctions} from '@ticlo/core';
import {metaKey} from '../comp/Component.tsx';
import {elementAttributes, elementClassProperty, elementStyleProperty} from '../comp/CommontProps.ts';
import {Values} from '../comp/Values.ts';
import {useBlockConfigs} from '../hooks/useBlockConfigs.ts';
import {useTicloComp} from '../hooks/useTicloComp.ts';
import {MarkdownParts} from './Markdown.tsx';
import {parseMarkdown} from './parseMarkdown.ts';

const props = {
  source: {value: Values.string},
};

/** The host owns the Block and any flows; Markdown only subscribes to its presentation properties. */
export function MarkdownElement({block}: {block: Block}) {
  const {source} = useBlockConfigs(block, props);
  const {style, className, optionalHandlers} = useTicloComp(block, {noChildren: true});
  const parts = useMemo(() => parseMarkdown(source ?? ''), [source]);
  return (
    <div style={style} className={className ?? 'ticl-markdown'} {...optionalHandlers}>
      <MarkdownParts key={block._blockId} parts={parts} />
    </div>
  );
}

globalFunctions.addFactory(
  null,
  {
    name: 'markdown',
    base: 'react:element',
    attributes: elementAttributes,
    tags: ['react-comp'],
    properties: [
      {name: 'source', type: 'string', mime: 'text/x-markdown'},
      {
        name: 'renderers',
        type: 'table',
        rowType: 'object',
        columns: [
          {key: 'type', type: 'string'},
          {key: 'renderer', type: 'worker'},
        ],
      },
      elementStyleProperty,
      elementClassProperty,
    ],
    category: 'react:elements',
  },
  'react',
  undefined,
  {meta: {[metaKey]: MarkdownElement}}
);
