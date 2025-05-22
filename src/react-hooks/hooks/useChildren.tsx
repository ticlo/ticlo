import {ReactNode, useEffect, useReducer, useRef, useState} from 'react';
import {Block, BlockIO, smartStrCompare} from '@ticlo/core';
import {BlockChildWatch} from '@ticlo/core/block/Block';
import {Values} from '../types/Values';
import {useBlockProps} from './useBlockProps';

const groupPropMap = {
  '#children': {value: Values.array, pinned: true},
  '#output': {value: Values.arrayOptional, pinned: true},
};

/**
 * Get the list of children blocks from #children config
 * @param block
 */
export function useChildren(block: Block): Block[] {
  const [, forceUpdate] = useReducer((x) => -x, 1);
  const {'#children': children, '#output': output} = useBlockProps(block, groupPropMap);
  useEffect(() => {
    if (output) {
      // repeater mode
    } else {
      // inline children
      const listener = {
        onChildChange: (property) => {
          if (children.includes(property._name)) {
            forceUpdate();
          }
        },
      } as BlockChildWatch;
      block.watch(listener);
      return () => {
        block.unwatch(listener);
      };
    }
  }, [block, output, children]);

  let result: Block[] = [];
  if (output) {
    // repeater mode
    for (const child of output as Record<string, unknown>[]) {
      const root: unknown = child?.['#root'];
      if (root instanceof Block) {
        result.push(root);
      }
    }
  } else {
    // inline children
    for (const name of children) {
      if (typeof name === 'string') {
        const b = block.getValue(name);
        if (b instanceof Block) {
          result.push(b);
        }
      }
    }
  }

  return result;
}
