import React, {useMemo} from 'react';
import {Block, globalFunctions} from '@ticlo/core';
import {metaKey} from '../comp/Component.tsx';
import {elementClassProperty, elementStyleProperty} from '../comp/CommontProps.ts';
import {Values} from '../comp/Values.ts';
import {useBlockConfigs} from '../hooks/useBlockConfigs.ts';
import {MarkdownParts} from './Markdown.tsx';
import {parseMarkdown} from './parseMarkdown.ts';

const props = {
  source: {value: Values.string},
  style: {value: Values.objectOptional},
  class: {value: Values.string},
};

/** The host owns the Block and any flows; Markdown only subscribes to its presentation properties. */
export function MarkdownElement({block}: {block: Block}) {
  const {source, style, class: className} = useBlockConfigs(block, props);
  const parts = useMemo(() => parseMarkdown(source ?? ''), [source]);
  return (
    <div style={style} className={className ?? 'ticl-markdown'}>
      <MarkdownParts key={block._blockId} parts={parts} />
    </div>
  );
}

globalFunctions.addFactory(
  null,
  {
    name: 'markdown',
    base: 'react:element',
    properties: [{name: 'source', type: 'string', mime: 'text/x-markdown'}, elementStyleProperty, elementClassProperty],
    category: 'react:elements',
  },
  'react',
  undefined,
  {meta: {[metaKey]: MarkdownElement}}
);
