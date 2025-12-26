import {ReactNode, useEffect, useReducer, useRef, useState} from 'react';
import {Block, BlockIO, smartStrCompare} from '@ticlo/core';
import {BlockChildWatch} from '@ticlo/core/block/Block.js';
import {Values} from '../types/Values.js';
import {useBlockProps} from './useBlockProps.js';

const groupPropMap = {
  '#children': {value: Values.array, pinned: true},
  '#output': {value: Values.arrayOptional, pinned: true},
};

export function getChildren(block: Block, output?: Record<string, unknown>[], children?: unknown[]): Block[] {
  if (output === undefined) {
    output = block.getValue('#output') as Record<string, unknown>[];
  }
  let result: Block[] = [];
  if (Array.isArray(output)) {
    // repeater mode
    for (const child of output) {
      const root: unknown = child?.['#root'];
      if (root instanceof Block) {
        result.push(root);
      }
    }
  } else {
    if (children === undefined) {
      children = block.getValue('#children') as unknown[] | [];
    }
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

/**
 * Get the list of children blocks from #children config
 * @param block
 */
export function useChildren(block: Block): Block[] {
  const [, forceUpdate] = useReducer((x) => -x, 1);
  const {'#children': children, '#output': output} = useBlockProps(block, groupPropMap);
  useEffect(() => {
    if (Array.isArray(output)) {
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

  return getChildren(block, output as Record<string, unknown>[], children);
}
