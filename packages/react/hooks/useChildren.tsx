import {ReactNode, useEffect, useReducer, useRef, useState} from 'react';
import {Block, BlockIO, smartStrCompare} from '@ticlo/core';
import {BlockChildWatch} from '@ticlo/core/block/Block.js';
import {Values} from '../types/Values.js';
import {useBlockProps} from './useBlockProps.js';

const groupPropMap = {
  '+children': {value: Values.array, pinned: true},
  '+override': {value: Values.arrayOptional, pinned: true},
};

export function getChildren(block: Block, override?: unknown[], children?: unknown[]): Block[] {
  if (override === undefined) {
    override = block.getValue('+override') as unknown[];
  }
  let result: Block[] = [];
  if (Array.isArray(override)) {
    // override children with an array of blocks
    for (const child of override) {
      if (child instanceof Block) {
        result.push(child);
      }
    }
  } else {
    if (children === undefined) {
      children = block.getValue('+children') as unknown[] | [];
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
 * Get the list of children blocks from +children config
 * @param block
 */
export function useChildren(block: Block): Block[] {
  const [, forceUpdate] = useReducer((x) => -x, 1);
  const {'+children': children, '+override': override} = useBlockProps(block, groupPropMap);
  useEffect(() => {
    if (Array.isArray(override)) {
      // override mode
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
  }, [block, override, children]);

  return getChildren(block, override, children);
}
